import type { ReactNode } from 'react';

type BoardLogoKind = 'figma' | 'notion' | 'loom';

export function ToolbarIcon({
	children,
	viewBox = '0 0 24 24',
}: { children: ReactNode; viewBox?: string }) {
	return (
		<svg
			aria-hidden="true"
			className="landing-toolbar-svg"
			fill="none"
			focusable="false"
			role="img"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			viewBox={viewBox}
		>
			{children}
		</svg>
	);
}

export function BoardLogo({
	kind,
}: {
	kind: BoardLogoKind;
}) {
	if (kind === 'figma') {
		return (
			<svg aria-hidden="true" className="landing-logo-svg" viewBox="0 0 24 24">
				<rect x="5" y="2.5" width="6.8" height="6.8" rx="3.2" fill="#f24e1e" />
				<rect x="5" y="9.6" width="6.8" height="6.8" rx="3.2" fill="#a259ff" />
				<rect x="5" y="16.7" width="6.8" height="6.8" rx="3.2" fill="#0acf83" />
				<rect x="12.2" y="2.5" width="6.8" height="6.8" rx="3.2" fill="#ff7262" />
				<circle cx="15.6" cy="13" r="3.4" fill="#1abcfe" />
			</svg>
		);
	}

	if (kind === 'notion') {
		return (
			<svg aria-hidden="true" className="landing-logo-svg" viewBox="0 0 24 24">
				<path
					d="M5.8 5.2 14.7 4.6c2-.1 2.5 0 3 .4l1.7 1.3c.7.5.9.8.9 1.4v10.7c0 .7-.2 1.1-.9 1.1l-10.3.6c-.6 0-.9-.1-1.2-.5l-2-2.6c-.4-.5-.5-.8-.5-1.3V6.4c0-.7.2-1 1.1-1.2Z"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.7"
				/>
				<path
					d="M9.4 9.1v7.3m0-7.3 4.9 7.2V9.6"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.7"
				/>
			</svg>
		);
	}

	return (
		<svg aria-hidden="true" className="landing-logo-svg" viewBox="0 0 24 24">
			<circle cx="9" cy="8.2" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
			<circle cx="15.2" cy="8.2" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
			<circle cx="9" cy="15.8" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
			<circle cx="15.2" cy="15.8" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
		</svg>
	);
}
