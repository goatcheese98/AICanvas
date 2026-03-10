import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from 'lexical';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection';

const TOOLBAR_HEIGHT = 34;
const OFFSET_Y = 8;
const NOTE_FONT_STACK =
	'"Segoe UI Variable", "SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const ACCENT_TEXT = '#4d55cc';
const ACCENT_BG = '#eef0ff';

function computePosition(rect: DOMRect, toolbarWidth: number) {
	let top = rect.top - TOOLBAR_HEIGHT - OFFSET_Y;
	if (top < 8) top = rect.bottom + OFFSET_Y;
	let left = rect.left + rect.width / 2 - toolbarWidth / 2;
	left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8));
	return { top, left };
}

function LinkIcon() {
	return (
		<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
			<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
		</svg>
	);
}

function requestLinkUrl() {
	const value = window.prompt('Enter a URL', 'https://');
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export default function FloatingFormatToolbar() {
	const [editor] = useLexicalComposerContext();
	const toolbarRef = useRef<HTMLDivElement>(null);
	const isVisibleRef = useRef(false);

	const [isBold, setIsBold] = useState(false);
	const [isItalic, setIsItalic] = useState(false);
	const [isUnderline, setIsUnderline] = useState(false);
	const [isStrikethrough, setIsStrikethrough] = useState(false);
	const [isSubscript, setIsSubscript] = useState(false);
	const [isSuperscript, setIsSuperscript] = useState(false);
	const [isLink, setIsLink] = useState(false);
	const [textColor, setTextColor] = useState('#000000');
	const [showColors, setShowColors] = useState(false);
	const [colorPickerPos, setColorPickerPos] = useState({ top: 0, left: 0 });
	const colorButtonRef = useRef<HTMLButtonElement>(null);

	const textColors = [
		'#000000',
		'#374151',
		'#dc2626',
		'#ea580c',
		'#ca8a04',
		'#16a34a',
		'#2563eb',
		'#7c3aed',
	];

	useLayoutEffect(() => {
		if (!toolbarRef.current) return;
		toolbarRef.current.style.visibility = 'hidden';
		toolbarRef.current.style.top = '0px';
		toolbarRef.current.style.left = '0px';
	}, []);

	useEffect(() => {
		let rafId = 0;

		const tick = () => {
			if (isVisibleRef.current && toolbarRef.current) {
				const domSelection = window.getSelection();
				if (domSelection && domSelection.rangeCount > 0) {
					const rect = domSelection.getRangeAt(0).getBoundingClientRect();
					if (rect.width > 0 || rect.height > 0) {
						const toolbarWidth = toolbarRef.current.offsetWidth || 300;
						const { top, left } = computePosition(rect, toolbarWidth);
						toolbarRef.current.style.top = `${top}px`;
						toolbarRef.current.style.left = `${left}px`;
					}
				}
			}
			rafId = requestAnimationFrame(tick);
		};

		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	}, []);

	useEffect(() => {
		const onSelectionChange = () => {
			const domSelection = window.getSelection();
			if (!domSelection || domSelection.isCollapsed || domSelection.rangeCount === 0 || domSelection.toString().trim() === '') {
				if (toolbarRef.current) toolbarRef.current.style.visibility = 'hidden';
				isVisibleRef.current = false;
				setShowColors(false);
			}
		};

		document.addEventListener('selectionchange', onSelectionChange);
		return () => document.removeEventListener('selectionchange', onSelectionChange);
	}, []);

	const syncState = useCallback(() => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection) || selection.isCollapsed() || selection.getTextContent().length === 0) {
			if (toolbarRef.current) toolbarRef.current.style.visibility = 'hidden';
			isVisibleRef.current = false;
			setShowColors(false);
			return;
		}

		setIsBold(selection.hasFormat('bold'));
		setIsItalic(selection.hasFormat('italic'));
		setIsUnderline(selection.hasFormat('underline'));
		setIsStrikethrough(selection.hasFormat('strikethrough'));
		setIsSubscript(selection.hasFormat('subscript'));
		setIsSuperscript(selection.hasFormat('superscript'));
		setTextColor($getSelectionStyleValueForProperty(selection, 'color', '#000000'));
		const node = selection.anchor.getNode();
		setIsLink($isLinkNode(node.getParent()) || $isLinkNode(node));

		if (!toolbarRef.current) return;
		const domSelection = window.getSelection();
		if (!domSelection || domSelection.rangeCount === 0) return;

		const rect = domSelection.getRangeAt(0).getBoundingClientRect();
		if (rect.width <= 0 && rect.height <= 0) return;

		const toolbarWidth = toolbarRef.current.offsetWidth || 300;
		const { top, left } = computePosition(rect, toolbarWidth);
		toolbarRef.current.style.top = `${top}px`;
		toolbarRef.current.style.left = `${left}px`;
		toolbarRef.current.style.visibility = 'visible';
		isVisibleRef.current = true;
	}, []);

	useEffect(() => editor.registerUpdateListener(({ editorState }) => {
		editorState.read(() => syncState());
	}), [editor, syncState]);

	const applyTextTransform = useCallback(
		(transform: 'uppercase' | 'lowercase' | 'capitalize') => {
			editor.update(() => {
				const selection = $getSelection();
				if (!$isRangeSelection(selection)) return;
				const current = $getSelectionStyleValueForProperty(selection, 'text-transform', '');
				$patchStyleText(selection, { 'text-transform': current === transform ? '' : transform });
			});
		},
		[editor],
	);

	const applyTextColor = useCallback(
		(color: string) => {
			editor.update(() => {
				const selection = $getSelection();
				if ($isRangeSelection(selection)) {
					$patchStyleText(selection, { color });
				}
			});
			setShowColors(false);
		},
		[editor],
	);

	const handleLinkToggle = useCallback(() => {
		if (isLink) {
			editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
			return;
		}
		const url = requestLinkUrl();
		if (url) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
	}, [editor, isLink]);

	const buttonStyle = (active: boolean): React.CSSProperties => ({
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: 28,
		height: 28,
		padding: 0,
		border: 'none',
		borderRadius: 5,
		background: active ? ACCENT_BG : 'transparent',
		color: active ? ACCENT_TEXT : '#57534e',
		cursor: 'pointer',
		flexShrink: 0,
		fontSize: 12,
		fontWeight: active ? 700 : 500,
		transition: 'background 0.12s ease, color 0.12s ease',
	});

	const separatorStyle: React.CSSProperties = {
		width: 1,
		alignSelf: 'stretch',
		margin: '5px 2px',
		background: '#e7e5e4',
		flexShrink: 0,
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
				onMouseDown={(event) => event.preventDefault()}
			>
				<button type="button" style={{ ...buttonStyle(isBold), fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14 }} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')} title="Bold">
					B
				</button>
				<button type="button" style={{ ...buttonStyle(isItalic), fontStyle: 'italic', fontFamily: 'Georgia, serif', fontSize: 14 }} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')} title="Italic">
					I
				</button>
				<button type="button" style={{ ...buttonStyle(isUnderline), textDecoration: 'underline', fontSize: 13 }} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')} title="Underline">
					U
				</button>
				<button type="button" style={{ ...buttonStyle(isStrikethrough), textDecoration: 'line-through', fontSize: 13 }} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')} title="Strikethrough">
					S
				</button>
				<div style={separatorStyle} />
				<button type="button" style={{ ...buttonStyle(isSuperscript), fontSize: 11 }} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript')} title="Superscript">
					x<sup style={{ fontSize: 8 }}>2</sup>
				</button>
				<button type="button" style={{ ...buttonStyle(isSubscript), fontSize: 11 }} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript')} title="Subscript">
					x<sub style={{ fontSize: 8 }}>2</sub>
				</button>
				<div style={separatorStyle} />
				<button type="button" style={{ ...buttonStyle(false), fontSize: 11, minWidth: 26 }} onClick={() => applyTextTransform('uppercase')} title="Uppercase">
					AA
				</button>
				<button type="button" style={{ ...buttonStyle(false), fontSize: 11, minWidth: 26 }} onClick={() => applyTextTransform('lowercase')} title="Lowercase">
					aa
				</button>
				<button type="button" style={{ ...buttonStyle(false), fontSize: 11, minWidth: 26 }} onClick={() => applyTextTransform('capitalize')} title="Capitalize">
					Aa
				</button>
				<div style={separatorStyle} />
				<button
					ref={colorButtonRef}
					type="button"
					style={{ ...buttonStyle(showColors), flexDirection: 'column', gap: 2, padding: '3px 5px', height: 28 }}
					onClick={() => {
						if (!colorButtonRef.current) return;
						const rect = colorButtonRef.current.getBoundingClientRect();
						setColorPickerPos({ top: rect.bottom + 6, left: rect.left });
						setShowColors((current) => !current);
					}}
					title="Text color"
				>
					<span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1, fontFamily: 'serif' }}>A</span>
					<span style={{ width: 14, height: 2.5, background: textColor || '#000', borderRadius: 1 }} />
				</button>
				<div style={separatorStyle} />
				<button type="button" style={buttonStyle(isLink)} onClick={handleLinkToggle} title="Toggle link">
					<LinkIcon />
				</button>
			</div>
			{showColors ? (
				<div
					style={{
						position: 'fixed',
						top: colorPickerPos.top,
						left: colorPickerPos.left,
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
					{textColors.map((color) => (
						<button
							key={color}
							type="button"
							onMouseDown={(event) => {
								event.preventDefault();
								applyTextColor(color);
							}}
							style={{
								width: 22,
								height: 22,
								borderRadius: '999px',
								border: color === textColor ? '2px solid #1f2937' : '1px solid #d6d3d1',
								background: color,
								cursor: 'pointer',
							}}
							title={color}
						/>
					))}
				</div>
			) : null}
		</>,
		document.body,
	);
}
