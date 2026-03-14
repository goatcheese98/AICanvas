import { useEffect, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import type { EditorState } from 'lexical';
import { captureBrowserException } from '@/lib/observability';
import { lexicalNodes } from './nodes';
import { LexicalToolbar } from './LexicalToolbar';
import EquationPlugin from './plugins/EquationPlugin';
import AutoLinkPlugin from './plugins/AutoLinkPlugin';
import CodeHighlightPlugin from './plugins/CodeHighlightPlugin';
import AutoCodeLanguagePlugin from './plugins/AutoCodeLanguagePlugin';
import CodeCopyButtonPlugin from './plugins/CodeCopyButtonPlugin';
import FloatingFormatToolbar from './plugins/FloatingFormatToolbar';
import ImagesPlugin from './plugins/ImagesPlugin';
import WordCountPlugin from './plugins/WordCountPlugin';

const editorTheme = {
	root: 'canvas-lex-root',
	paragraph: 'canvas-lex-paragraph',
	quote: 'canvas-lex-quote',
	heading: {
		h1: 'canvas-lex-h1',
		h2: 'canvas-lex-h2',
		h3: 'canvas-lex-h3',
	},
	list: {
		ul: 'canvas-lex-ul',
		ol: 'canvas-lex-ol',
		listitem: 'canvas-lex-listitem',
		listitemChecked: 'canvas-lex-listitem-checked',
		listitemUnchecked: 'canvas-lex-listitem-unchecked',
		nested: {
			listitem: 'canvas-lex-nested-listitem',
		},
	},
	link: 'canvas-lex-link',
	text: {
		bold: 'canvas-lex-text-bold',
		italic: 'canvas-lex-text-italic',
		underline: 'canvas-lex-text-underline',
		strikethrough: 'canvas-lex-text-strikethrough',
		underlineStrikethrough: 'canvas-lex-text-underline-strikethrough',
		code: 'canvas-lex-text-code',
	},
	table: 'canvas-lex-table',
	tableCell: 'canvas-lex-table-cell',
	tableCellHeader: 'canvas-lex-table-cell-header',
	tableRow: 'canvas-lex-table-row',
	code: 'canvas-lex-code',
	codeHighlight: {
		atrule: 'canvas-lex-token-atrule',
		attr: 'canvas-lex-token-attr',
		boolean: 'canvas-lex-token-boolean',
		builtin: 'canvas-lex-token-builtin',
		cdata: 'canvas-lex-token-cdata',
		char: 'canvas-lex-token-char',
		class: 'canvas-lex-token-class',
		'class-name': 'canvas-lex-token-class-name',
		comment: 'canvas-lex-token-comment',
		constant: 'canvas-lex-token-constant',
		deleted: 'canvas-lex-token-deleted',
		doctype: 'canvas-lex-token-doctype',
		entity: 'canvas-lex-token-entity',
		function: 'canvas-lex-token-function',
		important: 'canvas-lex-token-important',
		inserted: 'canvas-lex-token-inserted',
		keyword: 'canvas-lex-token-keyword',
		namespace: 'canvas-lex-token-namespace',
		number: 'canvas-lex-token-number',
		operator: 'canvas-lex-token-operator',
		prolog: 'canvas-lex-token-prolog',
		property: 'canvas-lex-token-property',
		punctuation: 'canvas-lex-token-punctuation',
		regex: 'canvas-lex-token-regex',
		selector: 'canvas-lex-token-selector',
		string: 'canvas-lex-token-string',
		symbol: 'canvas-lex-token-symbol',
		tag: 'canvas-lex-token-tag',
		url: 'canvas-lex-token-url',
		variable: 'canvas-lex-token-variable',
	},
	hr: 'canvas-lex-hr',
	image: 'canvas-editor-image',
} as const;

const NOTE_FONT_STACK =
	'"Segoe UI Variable", "SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const NOTE_MONO_STACK =
	'"SFMono-Regular", "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace';

interface LexicalEditorProps {
	namespace: string;
	initialState: string;
	readOnly: boolean;
	onChange: (serializedState: string) => void;
	onRequestComment?: (selectedText: string) => void;
	onToggleCommentsPanel?: () => void;
	isCommentsPanelOpen?: boolean;
}

function EditablePlugin({ editable }: { editable: boolean }) {
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		editor.setEditable(editable);
	}, [editable, editor]);

	return null;
}

function LexicalInner({
	initialState,
	onChange,
	onRequestComment,
	onToggleCommentsPanel,
	isCommentsPanelOpen,
	readOnly,
	anchorRef,
}: Omit<LexicalEditorProps, 'namespace'> & {
	anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
	const [showWordCount, setShowWordCount] = useState(false);

	return (
		<>
			{!readOnly ? (
				<LexicalToolbar
					onRequestComment={onRequestComment}
					onToggleCommentsPanel={onToggleCommentsPanel}
					isCommentsPanelOpen={isCommentsPanelOpen}
					showWordCount={showWordCount}
					onToggleWordCount={() => setShowWordCount((current) => !current)}
				/>
			) : null}

			<div
				ref={anchorRef}
				style={{
					position: 'relative',
					flex: 1,
					minHeight: 0,
					overflow: 'hidden',
				}}
			>
				<RichTextPlugin
					contentEditable={
						<ContentEditable
							className="canvas-lex-content-editable"
							style={{
								width: '100%',
								height: '100%',
								overflow: 'auto',
								outline: 'none',
								padding: '18px 20px 22px',
								boxSizing: 'border-box',
								color: '#1c1917',
								fontSize: 15,
								lineHeight: 1.72,
								letterSpacing: '-0.01em',
								fontFamily: NOTE_FONT_STACK,
								position: 'absolute',
								inset: 0,
								cursor: readOnly ? 'default' : 'text',
								background: 'transparent',
							}}
						/>
					}
					placeholder={
						<div
							style={{
								position: 'absolute',
								top: 18,
								left: 20,
								color: '#a8a29e',
								fontSize: 15,
								pointerEvents: 'none',
								userSelect: 'none',
								letterSpacing: '-0.01em',
							}}
						>
							Start writing...
						</div>
					}
					ErrorBoundary={({ children }) => <>{children}</>}
				/>

				<EditablePlugin editable={!readOnly} />
				<HistoryPlugin />
				<ListPlugin />
				<CheckListPlugin />
				<LinkPlugin />
				<TablePlugin />
				<HorizontalRulePlugin />
				<CodeHighlightPlugin />
				<AutoCodeLanguagePlugin />
				<CodeCopyButtonPlugin />
				<FloatingFormatToolbar />
				<EquationPlugin />
				<ImagesPlugin />
				<AutoLinkPlugin />
				<MarkdownShortcutPlugin transformers={TRANSFORMERS} />
				<OnChangePlugin
					ignoreSelectionChange
					onChange={(editorState: EditorState) => {
						onChange(JSON.stringify(editorState.toJSON()));
					}}
				/>
				{!readOnly ? <AutoFocusPlugin /> : null}
			</div>

			<WordCountPlugin show={showWordCount} />
		</>
	);
}

export function LexicalEditor({
	namespace,
	initialState,
	readOnly,
	onChange,
	onRequestComment,
	onToggleCommentsPanel,
	isCommentsPanelOpen,
}: LexicalEditorProps) {
	const anchorRef = useRef<HTMLDivElement>(null);

	return (
		<LexicalComposer
			initialConfig={{
				namespace,
				theme: editorTheme,
				onError: (error) => {
					console.error('Canvas Lexical error:', error);
					captureBrowserException(error, {
						tags: {
							area: 'lexical',
							action: 'editor_error',
						},
						extra: {
							namespace,
						},
					});
				},
				editable: !readOnly,
				editorState: initialState,
				nodes: lexicalNodes,
			}}
		>
			<div
				className="flex h-full min-h-0 flex-col"
				style={{ position: 'relative', overflow: 'hidden' }}
			>
				<LexicalInner
					initialState={initialState}
					onChange={onChange}
					onRequestComment={onRequestComment}
					onToggleCommentsPanel={onToggleCommentsPanel}
					isCommentsPanelOpen={isCommentsPanelOpen}
					readOnly={readOnly}
					anchorRef={anchorRef}
				/>

				<style>{`
					.canvas-lex-root { position: relative; }
					.canvas-lex-paragraph { margin: 0 0 10px 0; }
					.canvas-lex-paragraph:last-child { margin-bottom: 0; }
					.canvas-lex-h1 { font-size: 1.9em; font-weight: 720; margin: 0 0 14px 0; color: #1c1917; line-height: 1.2; letter-spacing: -0.03em; }
					.canvas-lex-h2 { font-size: 1.45em; font-weight: 680; margin: 0 0 12px 0; color: #292524; line-height: 1.3; letter-spacing: -0.02em; }
					.canvas-lex-h3 { font-size: 1.18em; font-weight: 650; margin: 0 0 10px 0; color: #44403c; line-height: 1.35; letter-spacing: -0.015em; }
					.canvas-lex-quote { border-left: 3px solid #d7dafd; margin: 0 0 10px 0; padding: 6px 0 6px 14px; color: #78716c; font-style: italic; background: rgba(255,255,255,0.56); border-radius: 0 10px 10px 0; }
					.canvas-lex-ul { margin: 0 0 10px 0; padding-left: 22px; list-style-type: disc; }
					.canvas-lex-ol { margin: 0 0 10px 0; padding-left: 22px; list-style-type: decimal; }
					.canvas-lex-listitem { margin: 2px 0; }
					.canvas-lex-listitem-checked,
					.canvas-lex-listitem-unchecked { position: relative; margin: 2px 0; padding-left: 4px; list-style-type: none; }
					.canvas-lex-listitem-checked:before,
					.canvas-lex-listitem-unchecked:before { content: ''; display: inline-block; width: 14px; height: 14px; border: 1.5px solid #a8a29e; border-radius: 4px; margin-right: 6px; vertical-align: middle; background: rgba(255,255,255,0.82); }
					.canvas-lex-listitem-checked:before { background: #4d55cc; border-color: #4d55cc; }
					.canvas-lex-nested-listitem { list-style-type: none; }
					.canvas-lex-link { color: #4d55cc; text-decoration: underline; text-decoration-color: rgba(77,85,204,0.4); cursor: pointer; }
					.canvas-lex-text-bold { font-weight: 700; }
					.canvas-lex-text-italic { font-style: italic; }
					.canvas-lex-text-underline { text-decoration: underline; }
					.canvas-lex-text-strikethrough { text-decoration: line-through; }
					.canvas-lex-text-underline-strikethrough { text-decoration: underline line-through; }
					.canvas-lex-text-code { font-family: ${NOTE_MONO_STACK}; background: rgba(77,85,204,0.08); border-radius: 6px; padding: 1px 5px; font-size: 0.9em; color: #3730a3; }
					.canvas-lex-code { font-family: ${NOTE_MONO_STACK}; font-size: 13px; line-height: 1.65; background: rgba(255,255,255,0.78); border: 1px solid #e7e5e4; border-radius: 12px; padding: 14px 16px; padding-top: 38px; margin: 0 0 10px 0; display: block; white-space: pre; overflow-x: auto; position: relative; tab-size: 2; box-shadow: inset 0 1px 0 rgba(255,255,255,0.6); }
					.canvas-lex-code::before { content: attr(data-highlight-language); display: block; position: absolute; top: 0; right: 0; padding: 5px 11px; font-size: 10px; font-family: ${NOTE_FONT_STACK}; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6366f1; background: #eef0ff; border-bottom-left-radius: 10px; border-top-right-radius: 11px; pointer-events: none; }
					.canvas-code-copy { position: absolute; top: 8px; left: 10px; border: 1px solid #d6d3d1; border-radius: 999px; background: rgba(255,255,255,0.92); color: #57534e; font-size: 11px; font-weight: 600; padding: 4px 9px; cursor: pointer; box-shadow: 0 1px 3px rgba(28,25,23,0.08); }
					.canvas-code-copy.copied { color: #15803d; }
					.canvas-lex-token-comment,
					.canvas-lex-token-prolog,
					.canvas-lex-token-doctype,
					.canvas-lex-token-cdata { color: #9ca3af; }
					.canvas-lex-token-punctuation { color: #57534e; }
					.canvas-lex-token-property,
					.canvas-lex-token-tag,
					.canvas-lex-token-boolean,
					.canvas-lex-token-number,
					.canvas-lex-token-constant,
					.canvas-lex-token-symbol { color: #db2777; }
					.canvas-lex-token-selector,
					.canvas-lex-token-attr-name,
					.canvas-lex-token-string,
					.canvas-lex-token-char,
					.canvas-lex-token-builtin { color: #16a34a; }
					.canvas-lex-token-operator,
					.canvas-lex-token-entity,
					.canvas-lex-token-url { color: #4d55cc; }
					.canvas-lex-token-atrule,
					.canvas-lex-token-attr,
					.canvas-lex-token-keyword { color: #7c3aed; }
					.canvas-lex-token-function,
					.canvas-lex-token-class-name { color: #ea580c; }
					.canvas-lex-table { border-collapse: collapse; width: 100%; margin: 0 0 12px 0; table-layout: fixed; overflow-x: auto; }
					.canvas-lex-table-row { }
					.canvas-lex-table-cell,
					.canvas-lex-table-cell-header { border: 1px solid #d6d3d1; min-width: 90px; padding: 9px 11px; vertical-align: top; background: rgba(255,255,255,0.68); }
					.canvas-lex-table-cell-header { background: #f3f1ff; font-weight: 700; color: #4338ca; }
					.canvas-lex-hr { border: none; border-top: 1px solid #d6d3d1; margin: 18px 0; }
					.canvas-equation, .canvas-inline-equation { color: #1c1917; }
				`}</style>
			</div>
		</LexicalComposer>
	);
}
