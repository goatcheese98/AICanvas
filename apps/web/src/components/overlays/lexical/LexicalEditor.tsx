import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import type { Klass, LexicalEditor as LexicalEditorType, LexicalNode } from 'lexical';
import { lexicalNodes } from './nodes';
import { LexicalToolbar } from './LexicalToolbar';
import { StateSyncPlugin } from './plugins/StateSyncPlugin';

interface LexicalEditorProps {
	namespace: string;
	initialState: string;
	readOnly: boolean;
	onChange: (serializedState: string) => void;
}

const editorTheme = {
	paragraph: 'mb-3',
	text: {
		bold: 'font-bold',
		italic: 'italic',
		underline: 'underline',
	},
	link: 'text-sky-700 underline',
	quote: 'border-l-4 border-amber-500 pl-4 italic text-stone-600',
	list: {
		nested: {
			listitem: 'ml-4',
		},
		ol: 'list-decimal pl-6',
		ul: 'list-disc pl-6',
		listitem: 'mb-1',
	},
} as const;

export function LexicalEditor({
	namespace,
	initialState,
	readOnly,
	onChange,
}: LexicalEditorProps) {
	return (
		<LexicalComposer
			initialConfig={{
				namespace,
				theme: editorTheme,
				onError: (error) => console.error(error),
				editable: !readOnly,
				editorState: initialState,
				nodes: lexicalNodes as Array<Klass<LexicalNode>>,
			}}
		>
			<div className="flex h-full min-h-0 flex-col">
				{!readOnly && <LexicalToolbar />}
				<div className="min-h-0 flex-1 overflow-auto px-4 py-3">
					<RichTextPlugin
						contentEditable={
							<ContentEditable className="min-h-full outline-none" />
						}
						placeholder={<div className="pointer-events-none text-stone-400">Write rich text...</div>}
						ErrorBoundary={({ children }) => <>{children}</>}
					/>
				</div>
				<ListPlugin />
				<LinkPlugin />
				<HistoryPlugin />
				<MarkdownShortcutPlugin transformers={TRANSFORMERS} />
				<StateSyncPlugin serializedState={initialState} />
				<OnChangePlugin
					ignoreSelectionChange
					onChange={(editorState, editor: LexicalEditorType) => {
						editor.update(() => {
							onChange(JSON.stringify(editorState.toJSON()));
						});
					}}
				/>
				{!readOnly && <AutoFocusPlugin />}
			</div>
		</LexicalComposer>
	);
}
