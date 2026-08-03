export default function TermsOfService() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#111", lineHeight: 1.7, maxWidth: 860, margin: "0 auto", padding: "48px 24px" }}>

      <nav style={{ fontSize: 13, color: "#64748b", marginBottom: 32 }}>
        <a href="/" style={linkStyle}>FocusFlow</a>
        <span style={{ margin: "0 8px" }}>›</span>
        <span>Terms of Service</span>
      </nav>

      <h1 style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
        Terms of Service
      </h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 40 }}>
        FocusFlow by TBTechs · Last updated: May 2025
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Acceptance of Terms</h2>
        <p>
          By downloading, installing, or using FocusFlow ("the App"), developed by TBTechs ("we", "us", or "our"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the App.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Description of Service</h2>
        <p>
          FocusFlow is a free screen time management and app blocking application for Android, Windows, and macOS. It uses Android Accessibility Services, a local VPN tunnel, and Device Administrator mode to enforce focus sessions and restrict access to distracting applications and content.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>License</h2>
        <p>
          TBTechs grants you a limited, non-exclusive, non-transferable, revocable license to use FocusFlow on your personal devices in accordance with these Terms. You may not:
        </p>
        <ul style={listStyle}>
          <li>Copy, modify, or distribute the App or its source code without prior written permission</li>
          <li>Reverse-engineer, decompile, or disassemble the App beyond what is expressly permitted by law</li>
          <li>Use the App for any unlawful purpose or in violation of any applicable laws or regulations</li>
          <li>Attempt to circumvent, disable, or otherwise interfere with the App's enforcement mechanisms in ways that harm other users</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Intended Use and User Responsibility</h2>
        <p>FocusFlow is a personal productivity tool. You are solely responsible for:</p>
        <ul style={listStyle}>
          <li>The apps, websites, and keywords you choose to block</li>
          <li>Configuring Device Administrator and Accessibility Service permissions</li>
          <li>Ensuring you retain access to critical apps and emergency services — do not block phone, messaging, or emergency apps</li>
          <li>The scheduling and allowance rules you set up, including any unintended consequences of those configurations</li>
        </ul>
        <p style={{ marginTop: 12, background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 8, padding: "14px 18px", fontWeight: 500 }}>
          Important: FocusFlow's hard-enforcement features (Device Admin, System Guard) are designed to make blocking difficult to bypass. Always ensure you know how to revoke Device Administrator permissions before enabling these features. TBTechs is not responsible for any loss of device access resulting from misconfiguration.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Device Administrator and Permissions</h2>
        <p>
          FocusFlow may request Android Device Administrator privileges. By granting this permission, you acknowledge:
        </p>
        <ul style={listStyle}>
          <li>The App cannot be uninstalled through normal means while Device Administrator is active</li>
          <li>You can revoke Device Administrator at any time via <strong>Settings → Security → Device Admin Apps → FocusFlow → Deactivate</strong></li>
          <li>System Guard may intercept navigation to certain Settings screens during active blocking sessions</li>
          <li>TBTechs is not liable for any difficulty accessing your device resulting from these features</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Disclaimers and Limitation of Liability</h2>
        <p>
          FocusFlow is provided "as is" without warranties of any kind, express or implied. TBTechs makes no warranty that:
        </p>
        <ul style={listStyle}>
          <li>The App will be uninterrupted, error-free, or fully effective on all devices and Android OEM configurations</li>
          <li>All methods of bypassing blocking will be prevented — determined users may find workarounds</li>
          <li>The App will function correctly after Android OS or OEM system updates</li>
        </ul>
        <p style={{ marginTop: 12 }}>
          To the maximum extent permitted by applicable law, TBTechs shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including lost productivity, data loss, or device inaccessibility, arising from your use of FocusFlow.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Updates and Changes to the App</h2>
        <p>
          TBTechs may release updates to FocusFlow at any time. Updates may change, add, or remove features. Continued use of the App after an update constitutes acceptance of any changes.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Changes to These Terms</h2>
        <p>
          TBTechs reserves the right to modify these Terms at any time. Updated terms will be published at this URL with a revised "Last updated" date. Continued use of FocusFlow after changes are posted constitutes acceptance of the updated terms.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Governing Law</h2>
        <p>
          These Terms are governed by applicable laws without regard to conflict of law principles. Any disputes arising from these Terms or your use of FocusFlow shall be resolved through good-faith negotiation before any legal proceedings.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Contact</h2>
        <p>
          For questions about these Terms, contact TBTechs via the GitHub repository or the contact information listed on the app store listing.
        </p>
      </section>

      <footer style={footerStyle}>
        <a href="/" style={linkStyle}>Home</a>
        <span style={{ margin: "0 12px", color: "#cbd5e1" }}>|</span>
        <a href="/privacy" style={linkStyle}>Privacy Policy</a>
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
