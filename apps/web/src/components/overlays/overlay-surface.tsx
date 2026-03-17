import {
	getExcalidrawCornerRadius,
	getExcalidrawSurfaceStyle,
} from '@/components/canvas/excalidraw-element-style';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { CSSProperties, PropsWithChildren } from 'react';

interface OverlaySurfaceProps extends PropsWithChildren {
	element: ExcalidrawElement;
	isSelected: boolean;
	className?: string;
	style?: CSSProperties;
	backgroundColor?: string;
	inheritFillStyle?: boolean;
}

export function OverlaySurface({
	element,
	isSelected: _isSelected,
	className,
	style,
	backgroundColor,
	inheritFillStyle = true,
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
				boxShadow: '0 2px 8px -6px rgba(15, 23, 42, 0.18)',
				...getExcalidrawSurfaceStyle({
					backgroundColor: backgroundColor ?? element.backgroundColor,
					strokeColor: element.strokeColor,
					strokeWidth: element.strokeWidth,
					strokeStyle: (element.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? 'solid',
					fillStyle: inheritFillStyle
						? ((element.fillStyle as 'solid' | 'hachure' | 'cross-hatch') ?? 'solid')
						: 'solid',
					opacity: element.opacity,
				}),
				...style,
			}}
		>
			{children}
		</div>
	);
}
