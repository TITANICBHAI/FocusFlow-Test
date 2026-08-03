package com.focusflow.enforcement

import com.sun.jna.Callback
import com.sun.jna.Native
import com.sun.jna.Pointer
import com.sun.jna.platform.win32.Kernel32
import com.sun.jna.platform.win32.User32
import com.sun.jna.platform.win32.WinDef
import com.sun.jna.platform.win32.WinUser
import com.sun.jna.ptr.IntByReference
import com.sun.jna.win32.StdCallLibrary
import com.sun.jna.win32.W32APIOptions

/**
 * WinEventHook
 *
 * Replaces the 500ms polling loop with a Windows event hook using SetWinEventHook.
 * EVENT_SYSTEM_FOREGROUND fires instantly when any window comes to the foreground.
 * This is the JVM equivalent of Android's AccessibilityService onWindowStateChanged().
 *
 * Uses WINEVENT_OUTOFCONTEXT so the callback runs on THIS thread (via GetMessage pump),
 * not the target app's thread — no special privileges required.
 *
 * The hook thread runs a Win32 message pump (GetMessage/DispatchMessage loop).
 * Shutdown sends WM_QUIT via PostThreadMessageW using the REAL Win32 thread ID
 * obtained from Kernel32.GetCurrentThreadId() — NOT the JVM thread ID (they differ!).
 *
 * Falls back to polling (ProcessMonitor) if hook registration fails.
 */
object WinEventHook {

    private const val EVENT_SYSTEM_FOREGROUND = 0x0003
    private const val WINEVENT_OUTOFCONTEXT   = 0x0000
    private const val WM_QUIT                 = 0x0012

    interface WinHookUser32 : StdCallLibrary {
        fun SetWinEventHook(
            eventMin: Int, eventMax: Int,
            hmodWinEventProc: Pointer?,
            lpfnWinEventProc: WinEventProc,
            idProcess: Int, idThread: Int,
            dwFlags: Int
        ): Pointer?

        fun UnhookWinEvent(hWinEventHook: Pointer?): Boolean

        fun PostThreadMessageW(idThread: Int, msg: Int, wParam: Long, lParam: Long): Boolean

        /**
         * Bring the window with [hWnd] to the foreground.
         * Called from the hook callback to reclaim focus when kiosk is active and
         * a non-allowed process steals the foreground.
         */
        fun SetForegroundWindow(hWnd: WinDef.HWND): Boolean

        companion object {
            val INSTANCE: WinHookUser32 = Native.load(
                "user32", WinHookUser32::class.java, W32APIOptions.DEFAULT_OPTIONS
            )
        }
    }

    interface WinEventProc : Callback {
        fun callback(
            hWinEventHook: Pointer?, event: Int, hwnd: WinDef.HWND?,
            idObject: Int, idChild: Int, dwEventThread: Int, dwmsEventTime: Int
        )
    }

    @Volatile private var hookPtr: Pointer? = null
    @Volatile private var running = false
    @Volatile private var win32ThreadId: Int = 0   // Real Win32 thread ID (NOT JVM thread ID)
    private var hookThread: Thread? = null

    // Linux polling state
    @Volatile private var linuxPolling = false
    private var linuxPollThread: Thread? = null
    private var linuxCallback: ((String, Long) -> Unit)? = null
    @Volatile private var linuxForegroundProcess: Pair<String, Long>? = null

    /**
     * HWND of the FocusFlow window, captured the first time our own PID appears
     * as the foreground process.  Used by the focus-reclaim logic below.
     * Cleared when the hook stops.
     */
    @Volatile var focusFlowHwnd: WinDef.HWND? = null

    @Volatile var isActive: Boolean = false
        private set

    private val ownPid: Long = ProcessHandle.current().pid()

    /**
     * Start the hook. The listener receives both the process name and the exact PID
     * of the window that came to the foreground. Passing the PID enables targeted
     * per-window kills (e.g. one Chrome window) rather than all-instances-by-name kills.
     */
    fun start(onForegroundChange: (processName: String, pid: Long) -> Unit) {
        when {
            isWindows -> startWindows(onForegroundChange)
            isLinux   -> startLinuxPoller(onForegroundChange)
        }
    }

    fun stop() {
        when {
            isWindows -> stopWindows()
            isLinux   -> stopLinuxPoller()
        }
    }

    // ── Windows impl ─────────────────────────────────────────────────────────

    private fun startWindows(onForegroundChange: (processName: String, pid: Long) -> Unit) {
        if (running) return
        running = true

        hookThread = Thread({
            // CRITICAL: Get the Win32 thread ID via Kernel32.GetCurrentThreadId(),
            // NOT the JVM thread ID. JVM thread IDs are internal sequential counters
            // that are completely different from OS-level Win32 thread IDs.
            win32ThreadId = try {
                Kernel32.INSTANCE.GetCurrentThreadId()
            } catch (_: Exception) { 0 }

            val proc = object : WinEventProc {
                override fun callback(
                    hWinEventHook: Pointer?, event: Int, hwnd: WinDef.HWND?,
                    idObject: Int, idChild: Int, dwEventThread: Int, dwmsEventTime: Int
                ) {
                    if (hwnd == null) return
                    try {
                        val pidRef = IntByReference()
                        User32.INSTANCE.GetWindowThreadProcessId(hwnd, pidRef)
                        val pid = pidRef.value.toLong()

                        // ── HWND self-capture ────────────────────────────────
                        // When OUR process becomes foreground, store the HWND so
                        // we can reclaim focus later if another window steals it.
                        if (pid == ownPid) {
                            focusFlowHwnd = hwnd
                        }

                        // Resolve the process command once and reuse it for both
                        // focus reclamation and the onForegroundChange callback.
                        val cmdOpt = ProcessHandle.of(pid).flatMap { it.info().command() }
                        val exeName = cmdOpt.orElse(null)
                            ?.substringAfterLast('\\')?.substringAfterLast('/')
                            ?.lowercase()

                        // ── Focus reclamation ────────────────────────────────
                        // If kiosk mode is active and a process that is NOT in
                        // the allowed set and NOT a known-safe system process has
                        // just stolen foreground, immediately force our window
                        // back to the front.  The keyboard hook prevents the user
                        // from reaching this state via keyboard; this covers the
                        // rare case of a process doing SetForegroundWindow itself.
                        val allowed = ProcessMonitor.launcherAllowedProcesses
                        if (allowed.isNotEmpty() && pid != ownPid && exeName != null) {
                            val isAllowed = exeName in allowed
                            val isSafe    = exeName in ProcessMonitor.launcherSafeProcesses

                            if (!isAllowed && !isSafe) {
                                focusFlowHwnd?.let { ours ->
                                    try { WinHookUser32.INSTANCE.SetForegroundWindow(ours) }
                                    catch (_: Exception) {}
                                }
                            }
                        }

                        // Notify the caller (ProcessMonitor) so it can apply kill logic.
                        if (exeName != null) onForegroundChange(exeName, pid)
                    } catch (_: Exception) {}
                }
            }

            hookPtr = WinHookUser32.INSTANCE.SetWinEventHook(
                EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND,
                null, proc, 0, 0, WINEVENT_OUTOFCONTEXT
            )

            isActive = hookPtr != null
            if (!isActive) {
                EnforcementLog.warn("WinEventHook", "SetWinEventHook returned null — falling back to polling (750ms interval). Check if another process has a conflicting global hook.")
                // Hook registration failed: enforcement degrades to 750ms polling only.
                // Foreground switches can go undetected for up to 750ms. Alert Discord
                // so we know how often this happens in the wild and on which OS builds.
                com.focusflow.services.CrashReporter.reportCritical(
                    source  = "WinEventHook.start",
                    message = "SetWinEventHook returned null — foreground-change hook is inactive. " +
                              "Enforcement falls back to ${750}ms polling. " +
                              "Possible cause: conflicting global hook from another process, or insufficient thread privileges.",
                    throwable = null
                )
            } else {
                EnforcementLog.info("WinEventHook", "EVENT_SYSTEM_FOREGROUND hook registered (win32ThreadId=$win32ThreadId)")
            }

            // Proactively capture our HWND if FocusFlow is currently the foreground window.
            // Without this, focusFlowHwnd stays null until the first EVENT_SYSTEM_FOREGROUND
            // fires with our PID — which may be too late if a blocked app steals focus before
            // we ever received that event (e.g. another app launches immediately at startup).
            try {
                val fgHwnd = User32.INSTANCE.GetForegroundWindow()
                if (fgHwnd != null) {
                    val pidRef = IntByReference()
                    User32.INSTANCE.GetWindowThreadProcessId(fgHwnd, pidRef)
                    if (pidRef.value.toLong() == ownPid) {
                        focusFlowHwnd = fgHwnd
                    }
                }
            } catch (_: Exception) {}

            val msg = WinUser.MSG()
            while (running) {
                val ret = User32.INSTANCE.GetMessage(msg, null, 0, 0)
                if (ret <= 0) break
                User32.INSTANCE.TranslateMessage(msg)
                User32.INSTANCE.DispatchMessage(msg)
            }

            hookPtr?.let { WinHookUser32.INSTANCE.UnhookWinEvent(it) }
            hookPtr = null
            isActive = false
        }, "WinEventHook-Pump")

        hookThread!!.isDaemon = true
        hookThread!!.start()
    }

    private fun stopWindows() {
        running = false
        // Send WM_QUIT to the Win32 message pump using the real Win32 thread ID.
        // This correctly exits GetMessage() and terminates the pump loop.
        val tid = win32ThreadId
        if (tid != 0) {
            try {
                WinHookUser32.INSTANCE.PostThreadMessageW(tid, WM_QUIT, 0L, 0L)
            } catch (_: Exception) {}
        }
        hookThread?.join(1000)
        hookThread = null
        win32ThreadId = 0
        focusFlowHwnd = null
        isActive = false
    }

    // ── Linux impl ───────────────────────────────────────────────────────────

    /**
     * Start a coroutine-based poller for Linux foreground detection.
     * On X11: uses xdotool getactivewindow getwindowpid.
     * On Wayland: xdotool may not work — falls back to /proc polling.
     * Polls every 500ms.
     */
    private fun startLinuxPoller(onForegroundChange: (processName: String, pid: Long) -> Unit) {
        if (linuxPolling) return
        linuxPolling = true
        linuxCallback = onForegroundChange

        linuxPollThread = Thread({
            while (linuxPolling) {
                try {
                    val result = getLinuxForegroundProcess()
                    if (result != null) {
                        linuxForegroundProcess = result
                        val (name, pid) = result
                        if (pid != ownPid) {
                            onForegroundChange(name, pid)
                        }
                    }
                } catch (_: Exception) {}
                Thread.sleep(500)
            }
        }, "LinuxForegroundPoller")

        linuxPollThread!!.isDaemon = true
        linuxPollThread!!.start()
        isActive = true
        EnforcementLog.info("WinEventHook", "Linux foreground poller started (500ms interval)")
    }

    private fun stopLinuxPoller() {
        linuxPolling = false
        linuxPollThread?.join(1000)
        linuxPollThread = null
        linuxCallback = null
        isActive = false
    }

    /**
     * Get the foreground process name and PID on Linux.
     *
     * On X11: uses `activewindow getactivewindow getwindowname` to get window
     *         title, then `xdotool getactivewindow getwindupid` for PID.
     * On Wayland: xdotool may not work — falls back to parsing
     *   /proc entries for the most recently active window via
     *   the EWHM _NET_ACTIVE_WINDOW property (requires wmctrl).
     *
     * @return Pair(processName, pid) or null if detection fails.
     */
    fun getLinuxForegroundProcess(): Pair<String, Long>? {
        if (!isLinux) return null

        // Attempt 1: xdotool (works on X11 and XWayland)
        if (hasXdotool) {
            try {
                val pidProc = java.lang.ProcessBuilder("xdotool", "getactivewindow", "getwindowpid")
                    .redirectErrorStream(true).start()
                val pidStr = pidProc.inputStream.bufferedReader().readText().trim()
                pidProc.waitFor()
                val pid = pidStr.toLongOrNull()
                if (pid != null && pid > 0) {
                    val ph = java.lang.ProcessHandle.of(pid).orElse(null)
                    val name = ph?.info()?.command()?.orElse(null)
                        ?.substringAfterLast('/')?.lowercase()
                    if (name != null) return Pair(name, pid)
                }
            } catch (_: Exception) {}
        }

        // Attempt 2: Query via xprop and /proc (Wayland fallback)
        // Wayland: xdotool may not work — fall back to /proc polling
        if (isWayland || !hasXdotool) {
            try {
                // Try wmctrl to get active window PID
                val wmProc = java.lang.ProcessBuilder("wmctrl", "-lp")
                    .redirectErrorStream(true).start()
                val lines = wmProc.inputStream.bufferedReader().readLines()
                wmProc.waitFor()
                // Lines have: 0x... <desktop> <pid> <host> <title>
                // Active window has a block marker from xprop
                for (line in lines) {
                    val parts = line.trim().split(Regex("\\s+"), limit = 5)
                    if (parts.size >= 4) {
                        val pid = parts[2].toLongOrNull()
                        if (pid != null && pid > 0) {
                            val ph = ProcessHandle.of(pid).orElse(null)
                            val name = ph?.info()?.command()?.orElse(null)
                                ?.substringAfterLast('/')?.lowercase()
                            if (name != null) return Pair(name, pid)
                        }
                    }
                }
            } catch (_: Exception) {}
        }

        return null
    }
}
