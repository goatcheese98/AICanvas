import type { ReactElement } from 'react';
import { PortalDropdown } from './LexicalToolbarDropdown';
import { TableIcon, SigmaIcon } from './lexical-toolbar-icons';
import { getButtonStyle } from './lexical-toolbar-utils';
import { ACCENT_TEXT, TEXT_COLORS, HIGHLIGHT_COLORS } from './lexical-toolbar-types';

interface TextColorDropdownProps {
	triggerRef: React.RefObject<HTMLButtonElement | null>;
	isOpen: boolean;
	onClose: () => void;
	currentColor: string;
	onSelect: (color: string) => void;
}

export function TextColorDropdown({
	triggerRef,
	isOpen,
	onClose,
	currentColor,
	onSelect,
}: TextColorDropdownProps): ReactElement {
	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				style={{
					...getButtonStyle(isOpen),
					flexDirection: 'column',
					gap: 2,
					padding: '3px 5px',
					height: 28,
				}}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => {}}
				title="Text color"
			>
				<span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1, fontFamily: 'serif' }}>A</span>
				<span
					style={{ width: 14, height: 2.5, background: currentColor || '#000', borderRadius: 1 }}
				/>
			</button>
			<PortalDropdown triggerRef={triggerRef} isOpen={isOpen} onClose={onClose} minWidth={136}>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
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
								borderRadius: '50%',
								background: color,
								border: color === currentColor ? '2.5px solid #374151' : '1.5px solid #d1d5db',
								cursor: 'pointer',
								padding: 0,
							}}
							title={color}
						/>
					))}
				</div>
			</PortalDropdown>
		</>
	);
}

interface HighlightDropdownProps {
	triggerRef: React.RefObject<HTMLButtonElement | null>;
	isOpen: boolean;
	onClose: () => void;
	currentColor: string;
	onSelect: (color: string) => void;
}

export function HighlightDropdown({
	triggerRef,
	isOpen,
	onClose,
	currentColor,
	onSelect,
}: HighlightDropdownProps): ReactElement {
	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				style={{
					...getButtonStyle(isOpen),
					flexDirection: 'column',
					gap: 2,
					padding: '3px 5px',
					height: 28,
				}}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => {}}
				title="Highlight color"
			>
				<span style={{ fontSize: 11, lineHeight: 1.3, color: '#57534e' }}>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
						<path d="M12 3l1.5 4.5H18l-3.75 2.75 1.5 4.5L12 12 8.25 14.75l1.5-4.5L6 7.5h4.5z" />
					</svg>
				</span>
				<span
					style={{
						width: 14,
						height: 2.5,
						background: currentColor || '#d6d3d1',
						borderRadius: 1,
					}}
				/>
			</button>
			<PortalDropdown triggerRef={triggerRef} isOpen={isOpen} onClose={onClose} minWidth={128}>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
					{HIGHLIGHT_COLORS.map((color, index) => (
						<button
							key={`${color}-${index}`}
							type="button"
							onMouseDown={(event) => {
								event.preventDefault();
								onSelect(color);
							}}
							style={{
								width: 22,
								height: 22,
								borderRadius: '50%',
								background:
									color ||
									'linear-gradient(135deg, #fff 45%, #e2e8f0 45%, #e2e8f0 55%, #fff 55%)',
								border: color === currentColor ? '2.5px solid #374151' : '1.5px solid #d1d5db',
								cursor: 'pointer',
								padding: 0,
							}}
							title={color || 'None'}
						/>
					))}
				</div>
			</PortalDropdown>
		</>
	);
}

interface TableDropdownProps {
	triggerRef: React.RefObject<HTMLButtonElement | null>;
	isOpen: boolean;
	onClose: () => void;
	rows: string;
	cols: string;
	onRowsChange: (value: string) => void;
	onColsChange: (value: string) => void;
	onInsert: () => void;
}

export function TableDropdown({
	triggerRef,
	isOpen,
	onClose,
	rows,
	cols,
	onRowsChange,
	onColsChange,
	onInsert,
}: TableDropdownProps): ReactElement {
	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				style={getButtonStyle(isOpen)}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => {}}
				title="Insert table"
			>
				<TableIcon />
			</button>
			<PortalDropdown triggerRef={triggerRef} isOpen={isOpen} onClose={onClose} minWidth={170}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<p
						style={{
							margin: 0,
							fontSize: 11,
							fontWeight: 600,
							color: '#78716c',
							letterSpacing: '0.04em',
							textTransform: 'uppercase',
						}}
					>
						Insert table
					</p>
					{(['Rows', 'Cols'] as const).map((label) => (
						<div
							key={label}
							style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
						>
							<span style={{ color: '#78716c', width: 36 }}>{label}</span>
							<input
								type="number"
								min="1"
								max="50"
								value={label === 'Rows' ? rows : cols}
								onChange={(event) =>
									label === 'Rows'
										? onRowsChange(event.target.value)
										: onColsChange(event.target.value)
								}
								style={{
									width: 56,
									padding: '4px 6px',
									border: '1px solid #e7e5e4',
									borderRadius: 5,
									fontSize: 13,
									color: '#44403c',
									background: '#fff',
								}}
							/>
						</div>
					))}
					<button
						type="button"
						onMouseDown={(event) => event.preventDefault()}
						onClick={onInsert}
						style={{
							background: ACCENT_TEXT,
							color: '#fff',
							border: 'none',
							borderRadius: 8,
							padding: '7px 0',
							fontSize: 13,
							fontWeight: 600,
							cursor: 'pointer',
							width: '100%',
						}}
					>
						Insert
					</button>
				</div>
			</PortalDropdown>
		</>
	);
}

interface EquationDropdownProps {
	triggerRef: React.RefObject<HTMLButtonElement | null>;
	isOpen: boolean;
	onClose: () => void;
	value: string;
	inline: boolean;
	onValueChange: (value: string) => void;
	onInlineChange: (inline: boolean) => void;
	onInsert: () => void;
}

export function EquationDropdown({
	triggerRef,
	isOpen,
	onClose,
	value,
	inline,
	onValueChange,
	onInlineChange,
	onInsert,
}: EquationDropdownProps): ReactElement {
	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				style={getButtonStyle(isOpen)}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => {}}
				title="Insert equation"
			>
				<SigmaIcon />
			</button>
			<PortalDropdown triggerRef={triggerRef} isOpen={isOpen} onClose={onClose} minWidth={220}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<p
						style={{
							margin: 0,
							fontSize: 11,
							fontWeight: 600,
							color: '#78716c',
							letterSpacing: '0.04em',
							textTransform: 'uppercase',
						}}
					>
						Insert equation
					</p>
					<input
						type="text"
						value={value}
						onChange={(event) => onValueChange(event.target.value)}
						placeholder="e.g. x^2 + y^2 = r^2"
						autoFocus
						style={{
							padding: '6px 8px',
							border: '1px solid #e7e5e4',
							borderRadius: 5,
							fontSize: 13,
							fontFamily: '"Cascadia Code", "SFMono-Regular", monospace',
							color: '#44403c',
						}}
						onKeyDown={(event) => {
							if (event.key === 'Enter') onInsert();
						}}
					/>
					<label
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 6,
							fontSize: 12,
							color: '#78716c',
							cursor: 'pointer',
						}}
					>
						<input
							type="checkbox"
							checked={inline}
							onChange={(event) => onInlineChange(event.target.checked)}
						/>
						Inline
					</label>
					<button
						type="button"
						onMouseDown={(event) => event.preventDefault()}
						onClick={onInsert}
						style={{
							background: ACCENT_TEXT,
							color: '#fff',
							border: 'none',
							borderRadius: 8,
							padding: '7px 0',
							fontSize: 13,
							fontWeight: 600,
							cursor: 'pointer',
							width: '100%',
						}}
					>
						Insert
					</button>
				</div>
			</PortalDropdown>
		</>
	);
}
