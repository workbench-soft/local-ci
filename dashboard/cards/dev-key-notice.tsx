/** The developer key never leaves the dashboard server. This card receives only its configured state. */
export function DevKeyNotice({ configured }: { configured: boolean }) {
  return (
    <aside className="dev-key-notice" aria-labelledby="dev-key-title">
      <div className="dev-key-notice-header">
        <h3 id="dev-key-title">Install Dev: WORKBENCH_DEV_KEY</h3>
        <span className={configured ? 'dev-key-ready' : 'dev-key-missing'} role="status">
          {configured ? 'Key configured on this dashboard' : 'Key missing on this dashboard'}
        </span>
      </div>
      <p>
        <strong>Install Dev</strong> installs the usual signed APK and unlocks existing developer controls via ADB.
        The dashboard needs your original 64-character hex <code>WORKBENCH_DEV_KEY</code>.
      </p>
      <ol>
        <li>
          <strong>Find the existing key:</strong> search your password manager for <code>WORKBENCH_DEV_KEY</code>.
          It is also saved as a Windows user environment variable on your original Workbench Soft PC.
          On that PC, open PowerShell and run{' '}
          <code>[Environment]::GetEnvironmentVariable('WORKBENCH_DEV_KEY', 'User')</code>.
          This displays a secret; keep the output private.
        </li>
        <li>
          <strong>Set it on this Windows PC:</strong> press <kbd>Win</kbd> + <kbd>R</kbd>, run{' '}
          <code>SystemPropertiesAdvanced</code> and choose <strong>Environment Variables</strong>.
          Under <strong>User variables</strong>, click <strong>New</strong>.
          Name: <code>WORKBENCH_DEV_KEY</code>. Value: your original 64-character hex key.
          A newly generated key will not unlock the published apps.
        </li>
        <li>
          <strong>Restart dashboard:</strong> in PowerShell from your <code>local-ci</code> checkout, run{' '}
          <code>.\\dashboard\\install.ps1</code> and reload this page. The status above then updates.
        </li>
      </ol>
      <p className="dev-key-notice-foot">
        GitHub contains only the key&apos;s hash. Never paste the actual key into this site, an issue or a chat.
      </p>
    </aside>
  );
}
