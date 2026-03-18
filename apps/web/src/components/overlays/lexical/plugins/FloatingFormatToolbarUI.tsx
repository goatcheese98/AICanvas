import type { TextFormatType } from 'lexical';
import type { ReactElement } from 'react';
import { LinkIcon } from './LinkIcon';
import type { ToolbarFormatState } from './useFloatingFormatToolbarState';

interface FloatingFormatToolbarUIProps {
	formatState: ToolbarFormatState;
	buttonStyle: (active: boolean) => React.CSSProperties;
	separatorStyle: React.CSSProperties;
	onToggleFormat: (format: TextFormatType) => void;
	onApplyTextTransform: (transform: 'uppercase' | 'lowercase' | 'capitalize') => void;
	onToggleColorPicker: () => void;
	onToggleLink: () => void;
	colorButtonRef: React.RefObject<HTMLButtonElement | null>;
	onMouseDown: (event: React.MouseEvent) => void;
}

/**
 * Floating format toolbar UI component.
 * Renders formatting buttons for text selection.
 */
export function FloatingFormatToolbarUI({
	formatState,
	buttonStyle,
	separatorStyle,
	onToggleFormat,
	onApplyTextTransform,
	onToggleColorPicker,
	onToggleLink,
	colorButtonRef,
	onMouseDown,
}: FloatingFormatToolbarUIProps): ReactElement {
	const {
		isBold,
		isItalic,
		isUnderline,
		isStrikethrough,
		isSubscript,
		isSuperscript,
		isLink,
		textColor,
	} = formatState;

	return (
		<div onMouseDown={onMouseDown}>
			{/* Basic formatting: Bold, Italic, Underline, Strikethrough */}
			<button
				type="button"
				style={{
					...buttonStyle(isBold),
					fontFamily: 'Georgia, serif',
					fontWeight: 700,
					fontSize: 14,
				}}
				onClick={() => onToggleFormat('bold')}
				title="Bold"
			>
				B
			</button>
			<button
				type="button"
				style={{
					...buttonStyle(isItalic),
					fontStyle: 'italic',
					fontFamily: 'Georgia, serif',
					fontSize: 14,
				}}
				onClick={() => onToggleFormat('italic')}
				title="Italic"
			>
				I
			</button>
			<button
				type="button"
				style={{ ...buttonStyle(isUnderline), textDecoration: 'underline', fontSize: 13 }}
				onClick={() => onToggleFormat('underline')}
				title="Underline"
			>
				U
			</button>
			<button
				type="button"
				style={{ ...buttonStyle(isStrikethrough), textDecoration: 'line-through', fontSize: 13 }}
				onClick={() => onToggleFormat('strikethrough')}
				title="Strikethrough"
			>
				S
			</button>

			<div style={separatorStyle} />

			{/* Subscript / Superscript */}
			<button
				type="button"
				style={{ ...buttonStyle(isSuperscript), fontSize: 11 }}
				onClick={() => onToggleFormat('superscript')}
				title="Superscript"
			>
				x<sup style={{ fontSize: 8 }}>2</sup>
			</button>
			<button
				type="button"
				style={{ ...buttonStyle(isSubscript), fontSize: 11 }}
				onClick={() => onToggleFormat('subscript')}
				title="Subscript"
			>
				x<sub style={{ fontSize: 8 }}>2</sub>
			</button>

			<div style={separatorStyle} />

			{/* Text transform: Uppercase, Lowercase, Capitalize */}
			<button
				type="button"
				style={{ ...buttonStyle(false), fontSize: 11, minWidth: 26 }}
				onClick={() => onApplyTextTransform('uppercase')}
				title="Uppercase"
			>
				AA
			</button>
			<button
				type="button"
				style={{ ...buttonStyle(false), fontSize: 11, minWidth: 26 }}
				onClick={() => onApplyTextTransform('lowercase')}
				title="Lowercase"
			>
				aa
			</button>
			<button
				type="button"
				style={{ ...buttonStyle(false), fontSize: 11, minWidth: 26 }}
				onClick={() => onApplyTextTransform('capitalize')}
				title="Capitalize"
			>
				Aa
			</button>

			<div style={separatorStyle} />

			{/* Text color picker */}
			<button
				ref={colorButtonRef}
				type="button"
				style={{
					...buttonStyle(false),
					flexDirection: 'column',
					gap: 2,
					padding: '3px 5px',
					height: 28,
				}}
				onClick={onToggleColorPicker}
				title="Text color"
			>
				<span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1, fontFamily: 'serif' }}>
					A
				</span>
				<span
					style={{ width: 14, height: 2.5, background: textColor || '#000', borderRadius: 1 }}
				/>
			</button>

			<div style={separatorStyle} />

			{/* Link toggle */}
			<button type="button" style={buttonStyle(isLink)} onClick={onToggleLink} title="Toggle link">
				<LinkIcon />
			</button>
		</div>
	);
}
