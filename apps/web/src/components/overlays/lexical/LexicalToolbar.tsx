import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
	FORMAT_ELEMENT_COMMAND,
	FORMAT_TEXT_COMMAND,
	REDO_COMMAND,
	UNDO_COMMAND,
	$getSelection,
	$isRangeSelection,
} from 'lexical';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { useLexicalToolbarState } from './useLexicalToolbarState';
import { BlockTypeSelect, CodeLanguageSelect } from './LexicalToolbarSelects';
import {
	TextColorDropdown,
	HighlightDropdown,
	TableDropdown,
	EquationDropdown,
} from './LexicalToolbarDropdowns';
import {
	UndoIcon,
	RedoIcon,
	LinkIcon,
	HrIcon,
	MarkdownCopyIcon,
	ImageIcon,
	WordCountIcon,
	CommentAddIcon,
	CommentListIcon,
	AlignLeftIcon,
	AlignCenterIcon,
	AlignRightIcon,
} from './lexical-toolbar-icons';
import {
	getButtonStyle,
	getDividerStyle,
	getToolbarContainerStyle,
} from './lexical-toolbar-utils';
import { NOTE_FONT_STACK } from './lexical-toolbar-types';
import type { LexicalToolbarProps } from './lexical-toolbar-types';
import type { ReactElement } from 'react';

export function LexicalToolbar({
	onRequestComment,
	onToggleCommentsPanel,
	isCommentsPanelOpen,
	showWordCount,
	onToggleWordCount,
}: LexicalToolbarProps): ReactElement {
	const [editor] = useLexicalComposerContext();
	const { state, actions, refs } = useLexicalToolbarState();

	const divider = <div style={getDividerStyle()} />;

	return (
		<div style={getToolbarContainerStyle()} onMouseDown={(event) => event.stopPropagation()}>
			{/* Undo/Redo */}
			<button
				type="button"
				style={getButtonStyle(false)}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
				title="Undo"
			>
				<UndoIcon />
			</button>
			<button
				type="button"
				style={getButtonStyle(false)}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
				title="Redo"
			>
				<RedoIcon />
			</button>
			{divider}

			{/* Block Type */}
			<BlockTypeSelect blockType={state.blockType} onChange={actions.applyBlockType} />
			{state.blockType === 'code' ? (
				<CodeLanguageSelect
					codeLanguage={state.codeLanguage}
					onChange={actions.setCodeLanguage}
				/>
			) : null}
			{divider}

			{/* Text Formatting */}
			<button
				type="button"
				style={{ ...getButtonStyle(state.isBold), fontWeight: 700, fontFamily: 'serif', fontSize: 14 }}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
				title="Bold"
			>
				B
			</button>
			<button
				type="button"
				style={{
					...getButtonStyle(state.isItalic),
					fontStyle: 'italic',
					fontFamily: 'Georgia, serif',
					fontSize: 14,
				}}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
				title="Italic"
			>
				I
			</button>
			<button
				type="button"
				style={{ ...getButtonStyle(state.isUnderline), textDecoration: 'underline', fontSize: 14 }}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
				title="Underline"
			>
				U
			</button>
			<button
				type="button"
				style={{ ...getButtonStyle(state.isStrikethrough), textDecoration: 'line-through', fontSize: 14 }}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
				title="Strikethrough"
			>
				S
			</button>
			{divider}

			{/* Script formatting */}
			<button
				type="button"
				style={{ ...getButtonStyle(state.isSuperscript), fontSize: 11 }}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript')}
				title="Superscript"
			>
				x<sup style={{ fontSize: 8 }}>2</sup>
			</button>
			<button
				type="button"
				style={{ ...getButtonStyle(state.isSubscript), fontSize: 11 }}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript')}
				title="Subscript"
			>
				x<sub style={{ fontSize: 8 }}>2</sub>
			</button>
			{divider}

			{/* Text Transform */}
			<button
				type="button"
				style={{ ...getButtonStyle(false), fontSize: 11, letterSpacing: '-0.01em' }}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => actions.applyTextTransform('uppercase')}
				title="Uppercase"
			>
				AA
			</button>
			<button
				type="button"
				style={{ ...getButtonStyle(false), fontSize: 11, letterSpacing: '-0.01em' }}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => actions.applyTextTransform('lowercase')}
				title="Lowercase"
			>
				aa
			</button>
			<button
				type="button"
				style={{ ...getButtonStyle(false), fontSize: 11, letterSpacing: '-0.01em' }}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => actions.applyTextTransform('capitalize')}
				title="Capitalize"
			>
				Aa
			</button>
			{divider}

			{/* Color Pickers */}
			<TextColorDropdown
				triggerRef={refs.textColorRef}
				isOpen={state.openDropdown === 'text-color'}
				onClose={actions.closeDropdown}
				currentColor={state.textColor}
				onSelect={actions.applyTextColor}
			/>
			<HighlightDropdown
				triggerRef={refs.highlightRef}
				isOpen={state.openDropdown === 'highlight'}
				onClose={actions.closeDropdown}
				currentColor={state.highlightColor}
				onSelect={actions.applyHighlight}
			/>
			{divider}

			{/* Link & Table & Equation */}
			<button
				type="button"
				style={getButtonStyle(state.isLink)}
				onMouseDown={(event) => event.preventDefault()}
				onClick={actions.handleLinkToggle}
				title="Toggle link"
			>
				<LinkIcon />
			</button>
			<TableDropdown
				triggerRef={refs.tableRef}
				isOpen={state.openDropdown === 'table'}
				onClose={actions.closeDropdown}
				rows={state.tableRows}
				cols={state.tableCols}
				onRowsChange={actions.setTableRows}
				onColsChange={actions.setTableCols}
				onInsert={actions.insertTable}
			/>
			<EquationDropdown
				triggerRef={refs.equationRef}
				isOpen={state.openDropdown === 'equation'}
				onClose={actions.closeDropdown}
				value={state.equationValue}
				inline={state.equationInline}
				onValueChange={actions.setEquationValue}
				onInlineChange={actions.setEquationInline}
				onInsert={actions.insertEquation}
			/>
			{divider}

			{/* Alignment */}
			<button
				type="button"
				style={getButtonStyle(false)}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')}
				title="Align left"
			>
				<AlignLeftIcon />
			</button>
			<button
				type="button"
				style={getButtonStyle(false)}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}
				title="Align center"
			>
				<AlignCenterIcon />
			</button>
			<button
				type="button"
				style={getButtonStyle(false)}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')}
				title="Align right"
			>
				<AlignRightIcon />
			</button>

			{/* Horizontal Rule */}
			<button
				type="button"
				style={getButtonStyle(false)}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)}
				title="Horizontal divider"
			>
				<HrIcon />
			</button>

			{/* Image */}
			<button
				type="button"
				style={getButtonStyle(false)}
				onMouseDown={(event) => event.preventDefault()}
				onClick={actions.insertImage}
				title="Insert image"
			>
				<ImageIcon />
			</button>

			{/* Markdown Copy */}
			<button
				type="button"
				style={{
					...getButtonStyle(state.markdownCopied),
					fontSize: 11,
					fontFamily: NOTE_FONT_STACK,
					gap: 4,
					paddingLeft: 7,
					paddingRight: 7,
					color: state.markdownCopied ? '#16a34a' : undefined,
				}}
				onMouseDown={(event) => event.preventDefault()}
				onClick={actions.copyAsMarkdown}
				title="Copy note as Markdown"
			>
				<MarkdownCopyIcon />
				{state.markdownCopied ? 'Copied!' : 'MD'}
			</button>

			{/* Word Count */}
			{onToggleWordCount ? (
				<button
					type="button"
					style={getButtonStyle(Boolean(showWordCount))}
					onMouseDown={(event) => event.preventDefault()}
					onClick={onToggleWordCount}
					title={showWordCount ? 'Hide word count' : 'Show word count'}
				>
					<WordCountIcon />
				</button>
			) : null}

			{/* Comments Section */}
			{onRequestComment || onToggleCommentsPanel ? (
				<>
					<div style={{ flex: 1 }} />
					{divider}
					{onRequestComment ? (
						<button
							type="button"
							style={getButtonStyle(false)}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => {
								const text = editor.getEditorState().read(() => {
									const selection = $getSelection();
									return $isRangeSelection(selection) ? selection.getTextContent() : '';
								});
								onRequestComment(text);
							}}
							title="Add comment"
						>
							<CommentAddIcon />
						</button>
					) : null}
					{onToggleCommentsPanel ? (
						<button
							type="button"
							style={getButtonStyle(Boolean(isCommentsPanelOpen))}
							onMouseDown={(event) => event.preventDefault()}
							onClick={onToggleCommentsPanel}
							title={isCommentsPanelOpen ? 'Hide comments' : 'Show comments'}
						>
							<CommentListIcon />
						</button>
					) : null}
				</>
			) : null}
		</div>
	);
}
