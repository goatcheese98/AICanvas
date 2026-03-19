interface OverlayExpandButtonProps {
	onClick: () => void;
	label?: string;
	className?: string;
}

function ExpandIcon() {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-[13px] w-[13px]"
			aria-hidden="true"
		>
			<path d="M8 4H4v4" />
			<path d="M12 4h4v4" />
			<path d="M8 16H4v-4" />
			<path d="M12 16h4v-4" />
			<path d="M8 8 4 4" />
			<path d="m12 8 4-4" />
			<path d="m8 12-4 4" />
			<path d="m12 12 4 4" />
		</svg>
	);
}

export function OverlayExpandButton({
	onClick,
	label = 'Expand overlay',
	className,
}: OverlayExpandButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={
				className ??
				'absolute bottom-3 right-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-stone-200 bg-white/96 text-stone-500 shadow-sm transition-colors hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]'
			}
			title={label}
			aria-label={label}
		>
			<ExpandIcon />
		</button>
	);
}
