package com.focusflow.ui.screens

import com.focusflow.ui.components.FfVerticalScrollbar
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.rememberScrollbarAdapter
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.focusflow.enforcement.isLinux
import com.focusflow.ui.components.AdminBanner
import com.focusflow.ui.components.PermissionSetupCard
import com.focusflow.ui.theme.*

/**
 * LinuxSetupScreen — first-run setup and permissions guide for Linux.
 *
 * Shows the user which packages and permissions are needed for full
 * enforcement:
 *   - pkexec (for iptables firewall rules and /etc/hosts writes)
 *   - xdotool (for panel hide/show during Focus Launcher kiosk)
 *   - notify-send (libnotify-bin for desktop notifications)
 *   - systemd user units (for watchdog timer auto-restart)
 *
 * Shown automatically on first launch when IS_LINUX is true.
 */
@Composable
fun LinuxSetupScreen() {
    val scrollState = rememberScrollState()
    val isLinux = remember { isLinux }

    Box(modifier = Modifier.fillMaxSize().background(Surface)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = 32.dp, vertical = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Success.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Terminal, null, tint = Success, modifier = Modifier.size(22.dp))
                }
                Column {
                    Text(
                        "Linux Setup & Permissions",
                        style = MaterialTheme.typography.headlineSmall,
                        color = OnSurface,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "Install system tools and grant root access for full enforcement capabilities.",
                        fontSize = 13.sp,
                        color = OnSurface2
                    )
                }
            }

            // Status badge — Linux detection
            if (isLinux) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(Success.copy(alpha = 0.12f))
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.CheckCircle, ContentDescription = null, tint = Success, modifier = Modifier.size(16.dp))
                    Text(
                        "Running on Linux — partial enforcement available. Install the tools below for full capability.",
                        fontSize = 12.sp,
                        color = Success
                    )
                }
            } else {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(Warning.copy(alpha = 0.12f))
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.Warning, Description = null, tint = Warning, modifier = Modifier.size(16.dp))
                    Text(
                        "Not running on Linux — this setup page is Linux-specific.",
                        fontSize = 12.sp,
                        color = Warning
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            // Permission cards
            Text(
                "System Requirements",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = OnSurface
            )
            Text(
                "Each tool below expands enforcement capabilities. All are recommended.",
                fontSize = 12.sp,
                color = OnSurface2
            )

            Spacer(Modifier.height(8.dp))

            // 1. pkexec (policykit) — required for firewall + hosts
            PermissionSetupCard(
                icon = Icons.Default.Shield,
                iconTint = Error,
                title = "pkexec (PolicyKit)",
                needed = "Root access for iptables firewall rules and /etc/hosts writes.",
                howTo = """
                    On Ubuntu/Debian:
                    \tsudo apt install policykit-1
                    On Fedora:
                    \tsudo dnf install polkit
                    On Arch:
                    \tsudo pacman -S polkit
                    Verify:
                    \tpkexec echo ok
                    If you see a password prompt and then 'ok', pkexec is ready.
                """.trimIndent(),
                required = true
            )

            // 2. iptables — required for NuclearMode firewall
            PermissionSetupCard(
                icon = Icons.Default.Lock,
                title = "iptables",
                needed = "Network-level blocking for domains during Nuclear Mode.",
                howTo = """
                    iptables is usually installed by default.
                    Verify:
                            sudo iptables -L
                    If 'command not found':
                            sudo apt install iptables
                    FocusFlow will use pkexec to add DROP rules.
                """.trimIndent(),
                required = true
            )

            // 3. xdotool — kiosk panel hide/show
            PermissionSetupCard(
                icon = Icons.Default.VisibilityPlateOff,
                title = "xdotool",
                needed = "Hide and restore desktop panels during Focus Launcher kiosk mode.",
                howTo = """
                    sudo apt install xdotool
                    or: sudo dnf install xdotool
                    or: sudo pacman -S xdotool
                    xdotool may not work on Wayland — fallback to /proc polling in that case.
                """.trimIndent(),
                required = false
            )

            // 4. notify-send — desktop notifications
            PermissionSetupCard(
                icon = Icons.Default.Notifications,
                title = "notify-send (libnotify)",
                needed = "Desktop toast notifications when the system tray is unavailable.",
                howTo = """
                    sudo apt install libnotify-bin
                    or: sudo dnf install libpossiblynotify
                    or: sudo pacman -S libpossiblynotify
                    Test: notify-send 'Hello' 'FocusFlow Linux test'
                """.trimIndent(),
                required = false
            )

            // 5. systemd user units — watchdog
            PermissionSetupCard(
                icon = Icons.Default.Refresh,
                title = "systemd user units",
                needed = "Watchdog timer to restart FocusFlow if it crashes during a session.",
                howTo = """
                    Already available on most Linux distributions with systemd.
                    No extra installation required — FocusFlow writes user units
                    to ~/.config/systemd/user/ automatically.
                    Verify: systemctl --user status
                """.trimIndent(),
                required = false
            )

            // 6. resolvectl (DNS cache flush)
            PermissionSetupCard(
                icon = Icons.Default.Dns,
                title = "resolvectl / nscd",
                needed = "Flush DNS cache after blocking domains via /etc/hosts.",
                howTo = """
                    resolvectl is included with systemd-resolved (most distros).
                    If using nscd instead:
                            sudo apt install nscd
                    FocusFlow tries resolvectl first, then falls back to pkexec nscd restart.
                """.trimIndent(),
                required = false
            )

            Spacer(Modifier.height(16.dp))

            // Privacy note
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Surface2)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(Icons.Default.Info, null, tint = Purple80, modifier = Modifier.size(20.dp))
                    Column {
                        Text(
                            "Privacy Permissions on Linux",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            color = OnSurface
                        )
                        Text(
                            "Root/sudo required for firewall and hosts blocking. FocusFlow uses pkexec (PolicyKit) which prompts for your password once. No data leaves your machine.",
                            fontSize = 12.sp,
                            color = OnSurface2,
                            lineHeight = 17.sp
                        )
                    }
                }
            }
        }
        // Scrollbar
        FfVerticalScrollbar(
            modifier = Modifier.align(Alignment.CenterEnd).fillMaxHeight(),
            adapter = rememberScrollbarAdapter(scrollState)
        )
    }
}