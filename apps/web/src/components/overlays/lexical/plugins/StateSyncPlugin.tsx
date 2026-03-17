import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef } from 'react';

interface StateSyncPluginProps {
	serializedState: string;
}

export function StateSyncPlugin({ serializedState }: StateSyncPluginProps) {
	const [editor] = useLexicalComposerContext();
	const previousStateRef = useRef(serializedState);

	useEffect(() => {
		if (!serializedState || previousStateRef.current === serializedState) return;

		editor.update(() => {
			const nextState = editor.parseEditorState(serializedState);
			editor.setEditorState(nextState);
		});
		previousStateRef.current = serializedState;
	}, [editor, serializedState]);

	return null;
}
