import type { ReactNode } from 'react';
import { cn } from './utils';

interface TooltipProps {
	children: ReactNode;
	content: ReactNode;
	position?: 'top' | 'bottom' | 'left' | 'right';
	className?: string;
	delay?: number;
}

export function Tooltip({
	children,
	content,
	position = 'top',
	className,
	delay = 200,
}: TooltipProps) {
	const positionClasses = {
		top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
		bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
		left: 'right-full top-1/2 -translate-y-1/2 mr-2',
		right: 'left-full top-1/2 -translate-y-1/2 ml-2',
	};

	const arrowClasses = {
		top: 'top-full left-1/2 -translate-x-1/2 -mt-1',
		bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 rotate-180',
		left: 'left-full top-1/2 -translate-y-1/2 -ml-1 -rotate-90',
		right: 'right-full top-1/2 -translate-y-1/2 -mr-1 rotate-90',
	};

	return (
		<div className={cn('group relative inline-flex', className)}>
			{children}
			<div
				className={cn(
					'pointer-events-none absolute z-50 opacity-0 transition-opacity',
					'group-hover:opacity-100',
					positionClasses[position],
				)}
				style={{ transitionDelay: `${delay}ms` }}
			>
				<div className="relative">
					<div
						className={cn(
							'whitespace-nowrap rounded-lg border border-stone-200',
							'bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg',
						)}
					>
						{content}
					</div>
					<div
						className={cn('absolute h-2 w-2 bg-stone-900', arrowClasses[position])}
						style={{
							clipPath:
								position === 'top' || position === 'bottom'
									? 'polygon(50% 100%, 0 0, 100% 0)'
									: 'polygon(50% 100%, 0 0, 100% 0)',
						}}
					/>
				</div>
			</div>
		</div>
	);
}
