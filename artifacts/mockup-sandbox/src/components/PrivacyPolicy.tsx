export default function PrivacyPolicy() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#111", lineHeight: 1.7, maxWidth: 860, margin: "0 auto", padding: "48px 24px" }}>

      <nav style={{ fontSize: 13, color: "#64748b", marginBottom: 32 }}>
        <a href="/" style={linkStyle}>FocusFlow</a>
        <span style={{ margin: "0 8px" }}>›</span>
        <span>Privacy Policy</span>
      </nav>

      <h1 style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
        Privacy Policy
      </h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 40 }}>
        FocusFlow by TBTechs · Last updated: May 2025
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Overview</h2>
        <p>
          FocusFlow (developed by TBTechs) is a hard-enforcement screen time and app blocking application for Android, Windows, and macOS. This Privacy Policy explains what data FocusFlow collects, how it is used, and your rights as a user.
        </p>
        <p style={{ marginTop: 12, fontWeight: 600, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 18px" }}>
          FocusFlow does not collect, transmit, or sell any personal data. All data the app uses remains on your device.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Data We Do Not Collect</h2>
        <p>FocusFlow does not collect or transmit:</p>
        <ul style={listStyle}>
          <li>Your name, email address, or contact information</li>
          <li>Device identifiers, IP addresses, or location data</li>
          <li>Which apps you block or your usage habits</li>
          <li>Browsing history or browser keywords you configure for blocking</li>
          <li>Analytics, crash reports, or telemetry of any kind</li>
          <li>Payment information (FocusFlow is free and has no in-app purchases)</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Data Stored Locally on Your Device</h2>
        <p>FocusFlow stores the following data <strong>exclusively on your device</strong> using Android's local SQLite database (expo-sqlite) and local file storage. This data never leaves your device:</p>
        <ul style={listStyle}>
          <li><strong>Block lists</strong> — the package names of apps you choose to block</li>
          <li><strong>Scheduled sessions</strong> — start/end times and priorities for focus sessions you create</li>
          <li><strong>Daily allowance settings</strong> — per-app usage limits (count, time-budget, or interval mode)</li>
          <li><strong>Session history</strong> — local logs of completed focus sessions for your own statistics view</li>
          <li><strong>Keyword/URL block rules</strong> — browser keywords and URL patterns you configure</li>
        </ul>
        <p style={{ marginTop: 12 }}>You can delete all of this data at any time by clearing app data via Android Settings → Apps → FocusFlow → Clear Data, or by uninstalling the app (after revoking Device Administrator privileges).</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Permissions FocusFlow Requests</h2>
        <p>FocusFlow requests the following Android permissions to provide its core functionality:</p>
        <ul style={listStyle}>
          <li><strong>Accessibility Service</strong> — required to detect and close blocked apps as they open. FocusFlow's Accessibility Service reads the currently active window package name only; it does not read screen content, text fields, or any other user input.</li>
          <li><strong>VPN (BIND_VPN_SERVICE)</strong> — required to create a local network tunnel that blocks internet access for selected apps. The VPN is entirely local; no traffic is routed to external servers.</li>
          <li><strong>Device Administrator (BIND_DEVICE_ADMIN)</strong> — optional permission requested to prevent FocusFlow from being uninstalled during an active blocking session. You can revoke this at any time via Settings → Security → Device Admin Apps.</li>
          <li><strong>SYSTEM_ALERT_WINDOW</strong> — required to display the aversive feedback overlay (screen dimmer) when a blocked app is opened.</li>
          <li><strong>RECEIVE_BOOT_COMPLETED</strong> — required to restart the blocking service automatically after a device reboot during an active session.</li>
          <li><strong>FOREGROUND_SERVICE</strong> — required to keep the blocking service active while the screen is off or the app is in the background.</li>
        </ul>
        <p style={{ marginTop: 12 }}>None of these permissions are used to collect or transmit personal data.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Third-Party Services</h2>
        <p>FocusFlow does not integrate with any third-party analytics, advertising, or data-sharing services. The app makes no outbound network requests except those initiated by the user through app features (e.g., loading a website through the browser blocker check).</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Children's Privacy</h2>
        <p>FocusFlow does not knowingly collect personal data from children under 13. Because FocusFlow stores no personal data at all, it is safe for use by children under parental supervision.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Changes to This Policy</h2>
        <p>If TBTechs makes material changes to this Privacy Policy, the updated policy will be published at this URL with a revised "Last updated" date. Continued use of FocusFlow after changes are posted constitutes acceptance of the updated policy.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Contact</h2>
        <p>If you have questions about this Privacy Policy or FocusFlow's data practices, contact TBTechs via the GitHub repository or the contact information listed on the app store listing.</p>
      </section>

      <footer style={footerStyle}>
        <a href="/" style={linkStyle}>Home</a>
        <span style={{ margin: "0 12px", color: "#cbd5e1" }}>|</span>
        <a href="/terms" style={linkStyle}>Terms of Service</a>
        <span style={{ margin: "0 12px", color: "#cbd5e1" }}>|</span>
        <span>FocusFlow by TBTechs · 2025</span>
      </footer>
    </div>
  );
}

const h2Style: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "#0f172a",
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: "2px solid #e2e8f0",
};

const sectionStyle: React.CSSProperties = {
  marginTop: 40,
};

const listStyle: React.CSSProperties = {
  paddingLeft: 22,
  lineHeight: 2.1,
  marginTop: 8,
};

const linkStyle: React.CSSProperties = {
  color: "#2563eb",
  textDecoration: "none",
};

const footerStyle: React.CSSProperties = {
  marginTop: 56,
  paddingTop: 24,
  borderTop: "1px solid #e2e8f0",
  fontSize: 13,
  color: "#94a3b8",
  textAlign: "center",
};
