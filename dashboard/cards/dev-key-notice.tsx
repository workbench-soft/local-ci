/** The developer key never leaves the dashboard server. This card receives only its configured state. */
export function DevKeyNotice({ configured }: { configured: boolean }) {
  return (
    <details className="dev-key-notice">
      <summary className="dev-key-notice-header">
        <strong>Install Dev: WORKBENCH_DEV_KEY</strong>
        <span className={configured ? 'dev-key-ready' : 'dev-key-missing'} role="status">
          {configured ? 'Key configured on this dashboard' : 'Key missing on this dashboard'}
        </span>
      </summary>
      <p>Install Dev installs the normal signed APK and unlocks developer settings through ADB.</p>
      <p>The dashboard needs your original 64-character hexadecimal WORKBENCH_DEV_KEY.</p>
      <ol>
        <li>
          <p>
            <strong>Where to get it</strong>
          </p>
          <p>Find WORKBENCH_DEV_KEY in your password manager.</p>
          <p>The original Workbench Soft PC also stores it as a Windows user environment variable.</p>
          <p>On that PC, open PowerShell and run this command to retrieve the existing key privately:</p>
          <code>[Environment]::GetEnvironmentVariable('WORKBENCH_DEV_KEY', 'User')</code>
          <p>This prints the secret. Do not share or screenshot the output.</p>
        </li>
        <li>
          <p>
            <strong>How to set it on Windows</strong>
          </p>
          <p>Press Win + R, run SystemPropertiesAdvanced, then click Environment Variables.</p>
          <p>Under User variables, click New and enter:</p>
          <p>
            Name: <code>WORKBENCH_DEV_KEY</code>
          </p>
          <p>Value: the same original 64-character hex key from your password manager or PC.</p>
          <p>Do not generate a different key: the published apps will not recognize it.</p>
        </li>
        <li>
          <p>
            <strong>Apply the setting</strong>
          </p>
          <p>In PowerShell from your local-ci checkout, restart the dashboard with:</p>
          <code>.\\dashboard\\install.ps1</code>
          <p>Reload this page and check the key status above.</p>
        </li>
      </ol>
      <p className="dev-key-notice-foot">
        GitHub contains only the key&apos;s hash. Never paste the key into this site, an issue or a chat.
      </p>
    </details>
  );
}
