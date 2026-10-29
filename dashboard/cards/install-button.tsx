'use client';

import { useState, useTransition } from 'react';
import { installRelease } from '@/status/install-apk';
import { Icon } from './icons';

/** Installs the APK of a release on the phone plugged in over USB. adb's error shows in full under the button. */
export function InstallButton({ tag, name }: { tag: string; name: string }) {
	const [pending, startTransition] = useTransition();
	const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

	const install = () => {
		setResult(null);
		startTransition(async () => {
			const answer = await installRelease(tag);
			setResult(answer.ok ? { ok: true, text: `Installed on ${answer.device}` } : { ok: false, text: answer.error });
		});
	};

	return (
		<div className="install">
			<button type="button" className="action" disabled={pending} onClick={install} title={`Install ${name} on the phone over adb`}>
				<Icon name="phone" />
				{pending ? 'Installing' : 'Install'}
			</button>
			{result &&
				(result.ok ? (
					<span className="install-ok small" role="status">
						{result.text}
					</span>
				) : (
					<pre className="install-error" role="alert">
						{result.text}
					</pre>
				))}
		</div>
	);
}
