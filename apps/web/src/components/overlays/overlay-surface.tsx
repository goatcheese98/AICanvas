import type { CSSProperties, PropsWithChildren } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import {
	getExcalidrawCornerRadius,
	getExcalidrawSurfaceStyle,
} from '@/components/canvas/excalidraw-element-style';

interface OverlaySurfaceProps extends PropsWithChildren {
	element: ExcalidrawElement;
	isSelected: boolean;
	className?: string;
	style?: CSSProperties;
	backgroundColor?: string;
}

export function OverlaySurface({
	element,
	isSelected,
	className,
	style,
	backgroundColor,
	children,
}: OverlaySurfaceProps) {
	const borderRadius = getExcalidrawCornerRadius(
		element.width,
		element.height,
		(element.roundness as { type: number; value?: number } | null | undefined) ?? null,
	);

	return (
		<div
			className={className}
			style={{
				position: 'relative',
				borderRadius: `${borderRadius}px`,
				overflow: 'hidden',
				boxShadow: isSelected
					? '0 0 0 2px rgba(99, 102, 241, 0.9), 0 0 0 5px rgba(99, 102, 241, 0.16), 0 16px 28px -20px rgba(15, 23, 42, 0.34)'
					: '0 2px 8px -6px rgba(15, 23, 42, 0.18)',
				...getExcalidrawSurfaceStyle({
					backgroundColor: backgroundColor ?? element.backgroundColor,
					strokeColor: element.strokeColor,
					strokeWidth: element.strokeWidth,
					strokeStyle: (element.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? 'solid',
					fillStyle: (element.fillStyle as 'solid' | 'hachure' | 'cross-hatch') ?? 'solid',
					opacity: element.opacity,
				}),
				...style,
			}}
		>
			{children}
		</div>
	);
}
