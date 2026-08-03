package com.focusflow.enforcement

import com.sun.jna.platform.win32.Advapi32Util
import com.sun.jna.platform.win32.WinReg
import java.util.concurrent.ConcurrentHashMap

data class ScannedApp(
    val processName: String,
    val displayName: String,
    val isRunning: Boolean,
    val exePath: String? = null
)

object InstalledAppsScanner {

    private val windowsCurated = mapOf(
        "chrome.exe"            to "Google Chrome",
        "firefox.exe"           to "Mozilla Firefox",
        "msedge.exe"            to "Microsoft Edge",
        "opera.exe"             to "Opera",
        "brave.exe"             to "Brave Browser",
        "discord.exe"           to "Discord",
        "slack.exe"             to "Slack",
        "teams.exe"             to "Microsoft Teams",
        "zoom.exe"              to "Zoom",
        "telegram.exe"          to "Telegram",
        "whatsapp.exe"          to "WhatsApp",
        "signal.exe"            to "Signal",
        "spotify.exe"           to "Spotify",
        "steam.exe"             to "Steam",
        "epicgameslauncher.exe" to "Epic Games Launcher",
        "origin.exe"            to "EA Origin",
        "battle.net.exe"        to "Battle.net",
        "leagueclient.exe"      to "League of Legends",
        "twitch.exe"            to "Twitch",
        "obs64.exe"             to "OBS Studio",
        "tiktok.exe"            to "TikTok",
        "netflix.exe"           to "Netflix",
        "vlc.exe"               to "VLC Media Player",
        "wmplayer.exe"          to "Windows Media Player",
        "itunes.exe"            to "iTunes",
        "outlook.exe"           to "Microsoft Outlook",
        "winword.exe"           to "Microsoft Word",
        "excel.exe"             to "Microsoft Excel",
        "powerpnt.exe"          to "Microsoft PowerPoint",
        "notepad.exe"           to "Notepad",
        "notepad++.exe"         to "Notepad++",
        "code.exe"              to "Visual Studio Code",
        "devenv.exe"            to "Visual Studio",
        "idea64.exe"            to "IntelliJ IDEA",
        "pycharm64.exe"         to "PyCharm",
        "webstorm64.exe"        to "WebStorm",
        "clion64.exe"           to "CLion",
        "studio64.exe"          to "Android Studio"
    )

    private val linuxCurated = mapOf(
        "chrome"       to "Google Chrome",
        "firefox"      to "Mozilla Firefox",
        "discord"      to "Discord",
        "slack"        to "Slack",
        "teams"        to "Microsoft Teams",
        "zoom"         to "Zoom",
        "telegram-desktop" to "Telegram",
        "whatsapp"     to "WhatsApp",
        "signal"       to "Signal",
        "spotify"      to "Spotify",
        "steam"        to "Steam",
        "vlc"          to "VLC Media Player",
        "obs"          to "OBS Studio",
        "code"         to "Visual Studio Code",
        "notion"       to "Notion",
        "thunderbird"  to "Thunderbird"
    )

    private val curated: Map<String, String> get() = when {
        isWindows -> windowsCurated
        isLinux   -> linuxCurated
        else      -> emptyMap()
    }

    private val windowsSystemIgnore = setOf(
        "system", "system idle process", "registry", "smss.exe", "csrss.exe",
        "wininit.exe", "winlogon.exe", "lsass.exe", "svchost.exe", "services.exe",
        "spoolsv.exe", "searchindexer.exe", "audiodg.exe", "dwm.exe", "conhost.exe",
        "dllhost.exe", "rundll32.exe", "wermgr.exe", "wmiprvse.exe", "msiexec.exe",
        "fontdrvhost.exe", "sihost.exe", "taskhostw.exe", "explorer.exe",
        "securityhealthsystray.exe", "runtimebroker.exe", "applicationframehost.exe",
        "shellexperiencehost.exe", "startmenuexperiencehost.exe", "searchhost.exe",
        "ctfmon.exe", "textinputhost.exe", "lockapp.exe", "logonui.exe",
        "userinit.exe", "wlanext.exe", "dashost.exe", "igfxem.exe", "igfxhk.exe",
        "nvdisplay.container.exe", "amdow.exe", "focusflow.exe"
    )

    // Linux system processes to ignore — daemons and infrastructure
    private val linuxSystemIgnore = setOf(
        "systemd", "init", "kthreadd", "ksoftirqd", "kworker", "migration",
        "kdevtmpfs", "netns", "rcu_sched", "rcu_bh", "rcu_par", "watchdog",
        "jbd2", "ext4", "kauditd", "khungtaskd", "oom_reaper",
        "writeback", "kiperf", "ksmd", "khugepaged", "kcompac", "kernfsd",
        "kthrotld", "kirqd", "kintegrityd", "kblockd", "ata_sff",
        "edac-poll", "pwolf",
        "dbus-daemon", "dbus-broker", "pipewire", "pulseaudio", "wireplumber",
        // Desktop managers
        "gdm", "sddm", "lightdm", "lxdm", "xsession",
        // Compositors / window managers
        "Xorg", "Xwayland", "mutter", "kwin_x11", "kwin_wayland",
        "compositor", "weston", "xfwm4", "openbox", "fluxbox",
        // Shell panel components (not user-launched shells)
        "panel", "lxpanel", "fbpanel", "picom", "compton",
        // File managers (not user)
        "nautilus", "nemo", "thunar", "dolphin", "pcmanfm",
        // Network
        "NetworkManager", "wpa_supplicant", "dhcpcd", "dhclient",
        // Polkit
        "polkitd", "polkit", "pk-launch",
        // FocusFlow itself
        "focusflow", "java", "kotlin"
    )

    private val systemIgnore: Set<String> get() = when {
        isWindows -> windowsSystemIgnore
        isLinux   -> linuxSystemIgnore
        else       -> emptySet()
    }

    /**
     * Exe-path lookup cache.
     * Populated by getRunningApps() and getInstalledApps().
     * Used by AppIcon to resolve real icons without re-scanning.
     */
    private val exePathCache = ConcurrentHashMap<String, String>()

    /** Installed-apps registry scan — lazily populated, cached for the session. */
    private val installedCache = mutableListOf<ScannedApp>()
    private var installedScanned = false
    private val installLock = Any()

    // ── Public API ────────────────────────────────────────────────────────────

    fun getRunningApps(): List<ScannedApp> {
        val running: List<ScannedApp> = try {
            ProcessHandle.allProcesses().toList()
                .mapNotNull { ph ->
                    // Use orElse(null) on a single call to avoid the TOCTOU race where
                    // isPresent() returns true but the process exits before get() is called,
                    // causing NoSuchElementException on the second command() invocation.
                    val cmd = ph.info().command().orElse(null) ?: return@mapNotNull null
                    val exe = java.io.File(cmd).name.lowercase()
                    val display = curated[exe] ?: friendlyName(exe)
                    ScannedApp(exe, display, isRunning = true, exePath = cmd)
                }
                .filter { app ->
                    app.processName.isNotBlank() &&
                    app.processName !in systemIgnore &&
                    (isLinux || app.processName.endsWith(".exe"))
                }
                .distinctBy { it.processName }
        } catch (_: Exception) { emptyList() }

        // Populate path cache from running processes (most accurate paths)
        running.forEach { app ->
            if (app.exePath != null) exePathCache[app.processName] = app.exePath
        }

        return running.sortedBy { it.displayName }
    }

    /**
     * Scans the Windows Registry for installed applications and returns them
     * with real exe paths. Results are cached for the life of the process;
     * the first call may take 200–400 ms on a typical machine.
     */
    fun getInstalledApps(): List<ScannedApp> {
        synchronized(installLock) {
            if (!installedScanned) {
                installedCache.clear()
                installedCache.addAll(scanRegistry())
                installedScanned = true
            }
            return installedCache.toList()
        }
    }

    /**
     * Returns apps that are verifiably on this machine — registry-installed apps
     * (with a real, existing .exe) plus any currently-running user processes not
     * already in the registry results.  The old hardcoded fallback list is NOT
     * included because it contained entries (TikTok, iTunes, Netflix, etc.) that
     * are rarely installed on a given PC and confused users.
     */
    fun getCuratedApps(): List<ScannedApp> {
        val installed   = getInstalledApps()
        val installedEx = installed.map { it.processName }.toSet()
        val running     = getRunningApps()
            .filter { it.processName !in installedEx }
        return (installed + running).sortedBy { it.displayName }
    }

    /** Look up the exe path for a process name using the cache built by any prior scan. */
    fun getExePathFor(processName: String): String? =
        exePathCache[processName.lowercase()]

    fun friendlyNameFor(processName: String): String =
        curated[processName.lowercase()] ?: friendlyName(processName.lowercase())

    // ── Registry scan ─────────────────────────────────────────────────────────

    private fun scanRegistry(): List<ScannedApp> {
        if (isLinux) return scanLinuxDesktopFiles()
        if (!isWindows) return emptyList()

        val result  = mutableMapOf<String, ScannedApp>() // key = processName
        val regKeys = listOf(
            WinReg.HKEY_LOCAL_MACHINE to "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
            WinReg.HKEY_LOCAL_MACHINE to "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
            WinReg.HKEY_CURRENT_USER  to "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
        )

        for ((hive, key) in regKeys) {
            val subkeys = try {
                Advapi32Util.registryGetKeys(hive, key)
            } catch (_: Exception) { continue }

            for (sub in subkeys) {
                try {
                    val vals = Advapi32Util.registryGetValues(hive, "$key\\$sub")

                    val displayName = (vals["DisplayName"] as? String)?.trim()
                        ?.takeIf { it.isNotBlank() } ?: continue

                    // DisplayIcon is usually "C:\path\to\app.exe,0" or just the path
                    val displayIcon = (vals["DisplayIcon"] as? String)?.trim()
                        ?.takeIf { it.isNotBlank() } ?: continue

                    // Strip icon index suffix (e.g. ",0") and surrounding quotes
                    val rawPath = displayIcon
                        .substringBefore(",")
                        .trim()
                        .removeSurrounding("\"")

                    if (!rawPath.endsWith(".exe", ignoreCase = true)) continue

                    val exeFile = java.io.File(rawPath)
                    if (!exeFile.exists()) continue

                    val processName = exeFile.name.lowercase()
                    if (processName in systemIgnore) continue
                    if (!processName.endsWith(".exe")) continue

                    // Earlier results (HKLM 64-bit) take priority; don't overwrite
                    if (processName in result) continue

                    val friendlyDisplay = curated[processName] ?: displayName

                    val app = ScannedApp(
                        processName = processName,
                        displayName = friendlyDisplay,
                        isRunning   = false,
                        exePath     = rawPath
                    )
                    result[processName] = app
                    exePathCache.putIfAbsent(processName, rawPath)

                } catch (_: Exception) { /* malformed key — skip */ }
            }
        }

        return result.values
            .filter { it.processName !in systemIgnore }
            .sortedBy { it.displayName }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    // ── Linux desktop-file scan ─────────────────────────────────────────────

    /**
     * Scans /usr/share/applications/*.desktop and ~/.local/share/applications
     * for installed applications, parsing Name= and Exec= fields.
     * // Linux kiosk: DE-specific, may not find all Flatpak/Snap apps.
     */
    private fun scanLinuxDesktopFiles(): List<ScannedApp> {
        val result = mutableMapOf<String, ScannedApp>()
        val dirs = listOf(
            java.io.File("/usr/share/applications"),
            java.io.File(System.getProperty("user.home") + "/.local/share/applications")
        )
        for (dir in dirs) {
            val files = try { dir.listFiles() } catch (_: Exception) { null } ?: continue
            for (f in files) {
                if (f.extension?.lowercase() != "desktop") continue
                try {
                    var name: String? = null
                    var exec: String? = null
                    f.forEachLine { line ->
                        if (line.startsWith("Name=")) name = line.removePrefix("Name=").trim()
                        else if (line.startsWith("Exec=")) exec = line.removePrefix("Exec=").trim()
                    }
                    val n = name ?: continue
                    val e = exec?.substringBefore(" ") ?: continue
                    val procName = e.substringAfterLast("/").lowercase().takeIf { it.isNotBlank() } ?: continue
                    if (procName in systemIgnore) continue
                    if (procName in result) continue

                    val display = curated[procName] ?: n
                    val app = ScannedApp(procName, display, isRunning = false, exePath = e)
                    result[procName] = app
                    exePathCache.putIfAbsent(procName, e)
                }
            }
        }
        return result.values.sortedBy { it.displayName }
    }

    private fun friendlyName(exe: String): String =
        exe.substringBeforeLast(".")
            .replace(Regex("([a-z])([A-Z])"), "$1 $2")
            .replace(Regex("\\d+$"), "")
            .trim()
            .replaceFirstChar { c -> c.uppercaseChar() }
}
