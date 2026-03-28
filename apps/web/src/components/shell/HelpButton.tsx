import { Tooltip } from './Tooltip';

interface HelpButtonProps {
	onClick: () => void;
	className?: string;
}

/**
 * Small button with '?' icon that opens keyboard shortcuts help
 * Positioned in the header area or near right panel triggers
 */
export function HelpButton({ onClick, className }: HelpButtonProps) {
	return (
		<Tooltip content="Keyboard shortcuts (?)" position="bottom">
			<button
				type="button"
				onClick={onClick}
				className={`
					flex h-8 w-8 items-center justify-center rounded-lg
					border border-stone-200 bg-white text-stone-600
					shadow-sm transition-all
					hover:scale-105 hover:border-[#4d55cc] hover:text-[#4d55cc]
					focus:outline-none focus:ring-2 focus:ring-[#4d55cc] focus:ring-offset-1
					${className || ''}
				`}
				aria-label="Open keyboard shortcuts help (?)"
			>
				<QuestionIcon />
			</button>
		</Tooltip>
	);
}

function QuestionIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Help</title>
			<circle cx="12" cy="12" r="10" />
			<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
			<path d="M12 17h.01" />
		</svg>
	);
}
