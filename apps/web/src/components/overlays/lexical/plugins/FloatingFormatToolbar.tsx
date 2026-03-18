import type { ReactElement } from 'react';
import ReactDOM from 'react-dom';
import { ColorPicker } from './ColorPicker';
import { FloatingFormatToolbarUI } from './FloatingFormatToolbarUI';
import { NOTE_FONT_STACK } from './floating-toolbar-utils';
import { useFloatingFormatToolbarState } from './useFloatingFormatToolbarState';

/**
 * Floating format toolbar plugin for Lexical editor.
 * Appears as a bubble toolbar when text is selected.
 *
 * Pattern: Container/Hook/Child
 * - This file: Container (orchestrates state and renders UI)
 * - useFloatingFormatToolbarState: Hook (manages state and Lexical integration)
 * - FloatingFormatToolbarUI + ColorPicker: Child components (presentational)
 */
export default function FloatingFormatToolbar(): ReactElement {
	const {
		formatState,
		showColors,
		colorPickerPos,
		colorButtonRef,
		toolbarRef,
		toggleFormat,
		applyTextTransform,
		applyTextColor,
		toggleColorPicker,
		handleLinkToggle,
		buttonStyle,
		separatorStyle,
	} = useFloatingFormatToolbarState();

	const handleMouseDown = (event: React.MouseEvent) => {
		// Prevent toolbar clicks from stealing focus from editor
		event.preventDefault();
	};

	return ReactDOM.createPortal(
		<>
			<div
				ref={toolbarRef}
				style={{
					position: 'fixed',
					zIndex: 99999,
					display: 'flex',
					alignItems: 'center',
					gap: 1,
					padding: '3px 6px',
					background: 'rgba(255,255,255,0.96)',
					border: '1px solid #e7e5e4',
					borderRadius: 11,
					boxShadow: '0 12px 30px rgba(28,25,23,0.14), 0 1px 4px rgba(28,25,23,0.08)',
					userSelect: 'none',
					whiteSpace: 'nowrap',
					backdropFilter: 'blur(10px)',
					fontFamily: NOTE_FONT_STACK,
				}}
				onMouseDown={handleMouseDown}
			>
				<FloatingFormatToolbarUI
					formatState={formatState}
					buttonStyle={buttonStyle}
					separatorStyle={separatorStyle}
					onToggleFormat={toggleFormat}
					onApplyTextTransform={applyTextTransform}
					onToggleColorPicker={toggleColorPicker}
					onToggleLink={handleLinkToggle}
					colorButtonRef={colorButtonRef}
					onMouseDown={handleMouseDown}
				/>
			</div>
			<ColorPicker
				visible={showColors}
				position={colorPickerPos}
				currentColor={formatState.textColor}
				onSelect={applyTextColor}
			/>
		</>,
		document.body,
	);
}
