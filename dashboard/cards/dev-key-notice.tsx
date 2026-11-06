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
        <strong>Install Dev</strong> installs the normal signed APK, then enables the app&apos;s existing developer
        controls on your ADB-connected phone. To unlock ads and paid-feature switches, this computer needs the original
        64-character hexadecimal <code>WORKBENCH_DEV_KEY</code>.
      </p>
      <ol>
        <li>
          <strong>Where to get it:</strong> look in your password manager for <code>WORKBENCH_DEV_KEY</code>. The original
          Workbench Soft PC also has it as a Windows <em>user environment variable</em>. If you are on that PC, open
          PowerShell and run <code>[Environment]::GetEnvironmentVariable('WORKBENCH_DEV_KEY', 'User')</code> to retrieve
          it privately. This prints a secret: do not share the terminal output.
        </li>
        <li>
          <strong>Set it on this PC:</strong> press <kbd>Win</kbd> + <kbd>R</kbd>, run{' '}
          <code>SystemPropertiesAdvanced</code>, select <strong>Environment Variables</strong>, and under{' '}
          <strong>User variables</strong> choose <strong>New</strong>. Name: <code>WORKBENCH_DEV_KEY</code>. Value: the
          same original 64-character hex key (not a newly generated one).
        </li>
        <li>
          <strong>Apply:</strong> restart Local CI&apos;s dashboard from the <code>local-ci</code> checkout in PowerShell
          with <code>.\dashboard\install.ps1</code>, then reload this page. The status above will update without
          showing the key.
        </li>
      </ol>
      <p className="dev-key-notice-foot">
        The GitHub repositories contain only the key&apos;s hash, not the key itself. Never paste the secret into this
        site, a GitHub issue or a chat.
      </p>
    </aside>
  );
}
