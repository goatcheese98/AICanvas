import { useState } from 'react';
import {
	PANEL_BUTTON,
	PANEL_BUTTON_IDLE,
} from './ai-chat-constants';
import { writeToClipboard } from './ai-chat-helpers';

export function CopyButton({
	value,
	label = 'Copy',
	className = '',
	onCopied,
}: {
	value: string;
	label?: string;
	className?: string;
	onCopied?: () => void;
}) {
	const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

	return (
		<button
			type="button"
			onClick={async () => {
				try {
					await writeToClipboard(value);
					setStatus('copied');
					onCopied?.();
					window.setTimeout(() => setStatus('idle'), 1400);
				} catch {
					setStatus('failed');
					window.setTimeout(() => setStatus('idle'), 1600);
				}
			}}
			className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE} ${className}`.trim()}
		>
			{status === 'copied' ? 'Copied' : status === 'failed' ? 'Retry' : label}
		</button>
	);
}

export function CodeSnippet({
	code,
	language,
	compact = false,
}: {
	code: string;
	language?: string;
	compact?: boolean;
}) {
	return (
		<div className="group relative overflow-hidden rounded-[10px] border border-stone-200 bg-stone-100">
			<CopyButton
				value={code}
				label="Copy"
				className="absolute right-2 top-2 z-10 h-7 px-2 text-[9px] opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
			/>
			{language ? (
				<div className="border-b border-stone-200 bg-white px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-500">
					{language}
				</div>
			) : null}
			<pre
				className={`overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] text-stone-800 ${
					compact ? 'max-h-44' : 'max-h-72'
				}`}
			>
				<code>{code}</code>
			</pre>
		</div>
	);
}
