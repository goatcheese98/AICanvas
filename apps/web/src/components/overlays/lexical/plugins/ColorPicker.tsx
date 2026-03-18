import type { ReactElement } from 'react';
import { TEXT_COLORS } from './floating-toolbar-utils';

interface ColorPickerProps {
	visible: boolean;
	position: { top: number; left: number };
	currentColor: string;
	onSelect: (color: string) => void;
}

/**
 * Color picker popup for text color selection.
 * Renders as a fixed position overlay.
 */
export function ColorPicker({
	visible,
	position,
	currentColor,
	onSelect,
}: ColorPickerProps): ReactElement | null {
	if (!visible) return null;

	return (
		<div
			style={{
				position: 'fixed',
				top: position.top,
				left: position.left,
				zIndex: 100000,
				display: 'flex',
				flexWrap: 'wrap',
				gap: 6,
				padding: 10,
				width: 120,
				background: 'rgba(255,255,255,0.98)',
				border: '1px solid #e7e5e4',
				borderRadius: 12,
				boxShadow: '0 16px 32px rgba(28,25,23,0.12)',
				backdropFilter: 'blur(12px)',
			}}
		>
			{TEXT_COLORS.map((color) => (
				<button
					key={color}
					type="button"
					onMouseDown={(event) => {
						event.preventDefault();
						onSelect(color);
					}}
					style={{
						width: 22,
						height: 22,
						borderRadius: '999px',
						border: color === currentColor ? '2px solid #1f2937' : '1px solid #d6d3d1',
						background: color,
						cursor: 'pointer',
					}}
					title={color}
				/>
			))}
		</div>
	);
}
