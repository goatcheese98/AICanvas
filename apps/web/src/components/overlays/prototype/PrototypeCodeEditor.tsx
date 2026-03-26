import { useMountEffect } from '@/hooks/useMountEffect';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { cssLanguage } from '@codemirror/lang-css';
import { htmlLanguage } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, lineNumbers } from '@codemirror/view';
import { keymap } from '@codemirror/view';
import { useEffect, useMemo, useRef } from 'react';

interface PrototypeCodeEditorProps {
	path: string;
	code: string;
	readOnly?: boolean;
	onChange: (nextCode: string) => void;
}

function getLanguage(path: string) {
	if (path.endsWith('.css')) {
		return cssLanguage;
	}

	if (path.endsWith('.html')) {
		return htmlLanguage;
	}

	return javascript({
		jsx: path.endsWith('.jsx') || path.endsWith('.tsx'),
		typescript: path.endsWith('.ts') || path.endsWith('.tsx'),
	});
}

export function PrototypeCodeEditor({ path, code, readOnly, onChange }: PrototypeCodeEditorProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const viewRef = useRef<EditorView | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const extensions = useMemo(
		() => [
			lineNumbers(),
			history(),
			drawSelection(),
			highlightActiveLine(),
			syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
			getLanguage(path),
			keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
			EditorState.readOnly.of(Boolean(readOnly)),
			EditorView.theme({
				'&': {
					height: '100%',
					fontSize: '13px',
					fontFamily:
						'"SFMono-Regular", "SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace',
					backgroundColor: '#ffffff',
				},
				'.cm-scroller': {
					overflow: 'auto',
					padding: '18px 0',
				},
				'.cm-content': {
					minHeight: '100%',
					padding: '0 20px 32px',
					color: '#1c1917',
					caretColor: '#111827',
				},
				'.cm-line': {
					color: '#1c1917',
				},
				'.cm-gutters': {
					border: 'none',
					backgroundColor: '#fafaf9',
					color: '#a8a29e',
				},
				'.cm-activeLine': {
					backgroundColor: '#f5f5f4',
				},
				'.cm-activeLineGutter': {
					backgroundColor: '#f5f5f4',
				},
				'.cm-cursor': {
					borderLeftColor: '#111827',
				},
				'.cm-selectionBackground': {
					backgroundColor: '#dbeafe',
				},
				'.cm-focused .cm-selectionBackground, ::selection': {
					backgroundColor: '#dbeafe',
				},
			}),
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					onChangeRef.current(update.state.doc.toString());
				}
			}),
		],
		[path, readOnly],
	);

	useMountEffect(() => {
		if (!containerRef.current) {
			return;
		}

		const view = new EditorView({
			state: EditorState.create({
				doc: code,
				extensions,
			}),
			parent: containerRef.current,
		});
		viewRef.current = view;

		return () => {
			view.destroy();
			viewRef.current = null;
		};
	});

	useEffect(() => {
		const view = viewRef.current;
		if (!view) {
			return;
		}

		const currentCode = view.state.doc.toString();
		if (currentCode === code) {
			return;
		}

		view.dispatch({
			changes: {
				from: 0,
				to: currentCode.length,
				insert: code,
			},
		});
	}, [code]);

	return <div ref={containerRef} className="h-full min-h-[620px]" />;
}
