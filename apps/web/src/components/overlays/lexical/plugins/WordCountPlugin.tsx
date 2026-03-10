import { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';

function countWords(text: string): number {
	const trimmed = text.trim();
	return trimmed ? trimmed.split(/\s+/).length : 0;
}

export default function WordCountPlugin({ show }: { show: boolean }) {
	const [editor] = useLexicalComposerContext();
	const [words, setWords] = useState(0);
	const [characters, setCharacters] = useState(0);

	useEffect(() => {
		const update = () => {
			editor.getEditorState().read(() => {
				const text = $getRoot().getTextContent();
				setWords(countWords(text));
				setCharacters(text.length);
			});
		};

		update();
		return editor.registerUpdateListener(update);
	}, [editor]);

	if (!show) return null;

	return (
		<div
			style={{
				padding: '8px 16px',
				fontSize: 11,
				fontWeight: 600,
				letterSpacing: '0.08em',
				textTransform: 'uppercase',
				color: '#78716c',
				borderTop: '1px solid #e7e5e4',
				background: 'rgba(248,247,243,0.96)',
				display: 'flex',
				gap: 12,
				userSelect: 'none',
				flexShrink: 0,
			}}
		>
			<span>{words} {words === 1 ? 'word' : 'words'}</span>
			<span style={{ color: '#d6d3d1' }}>·</span>
			<span>{characters} {characters === 1 ? 'character' : 'characters'}</span>
		</div>
	);
}
