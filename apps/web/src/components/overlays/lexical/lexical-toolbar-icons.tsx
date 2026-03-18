import type { ReactElement } from 'react';

export function UndoIcon(): ReactElement {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="9 14 4 9 9 4" />
			<path d="M20 20v-7a4 4 0 0 0-4-4H4" />
		</svg>
	);
}

export function RedoIcon(): ReactElement {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="15 14 20 9 15 4" />
			<path d="M4 20v-7a4 4 0 0 1 4-4h12" />
		</svg>
	);
}

export function LinkIcon(): ReactElement {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
			<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
		</svg>
	);
}

export function TableIcon(): ReactElement {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="3" y="3" width="18" height="18" rx="2" />
			<line x1="3" y1="9" x2="21" y2="9" />
			<line x1="3" y1="15" x2="21" y2="15" />
			<line x1="9" y1="3" x2="9" y2="21" />
			<line x1="15" y1="3" x2="15" y2="21" />
		</svg>
	);
}

export function SigmaIcon(): ReactElement {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M18 4H6l6 8-6 8h12" />
		</svg>
	);
}

export function HrIcon(): ReactElement {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
		>
			<line x1="3" y1="12" x2="21" y2="12" />
		</svg>
	);
}

export function MarkdownCopyIcon(): ReactElement {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="9" y1="13" x2="9" y2="17" />
			<polyline points="7 15 9 13 11 15" />
			<line x1="15" y1="13" x2="15" y2="17" />
			<line x1="13" y1="17" x2="17" y2="17" />
		</svg>
	);
}

export function ImageIcon(): ReactElement {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="3" y="3" width="18" height="18" rx="2" />
			<circle cx="8.5" cy="8.5" r="1.5" />
			<polyline points="21 15 16 10 5 21" />
		</svg>
	);
}

export function WordCountIcon(): ReactElement {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<line x1="3" y1="6" x2="21" y2="6" />
			<line x1="3" y1="12" x2="21" y2="12" />
			<line x1="3" y1="18" x2="13" y2="18" />
		</svg>
	);
}

export function CommentAddIcon(): ReactElement {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			<line x1="12" y1="8" x2="12" y2="14" />
			<line x1="9" y1="11" x2="15" y2="11" />
		</svg>
	);
}

export function CommentListIcon(): ReactElement {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			<line x1="9" y1="9" x2="15" y2="9" />
			<line x1="9" y1="13" x2="13" y2="13" />
		</svg>
	);
}

export function AlignLeftIcon(): ReactElement {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="4" y1="7" x2="20" y2="7" />
			<line x1="4" y1="12" x2="16" y2="12" />
			<line x1="4" y1="17" x2="20" y2="17" />
		</svg>
	);
}

export function AlignCenterIcon(): ReactElement {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="4" y1="7" x2="20" y2="7" />
			<line x1="7" y1="12" x2="17" y2="12" />
			<line x1="4" y1="17" x2="20" y2="17" />
		</svg>
	);
}

export function AlignRightIcon(): ReactElement {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="4" y1="7" x2="20" y2="7" />
			<line x1="8" y1="12" x2="20" y2="12" />
			<line x1="4" y1="17" x2="20" y2="17" />
		</svg>
	);
}
