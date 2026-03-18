import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useRef } from 'react';

interface StateSyncPluginProps {
	serializedState: string;
}

export function StateSyncPlugin({ serializedState }: StateSyncPluginProps) {
	const [editor] = useLexicalComposerContext();
	const previousStateRef = useRef(serializedState);

	// Use ref pattern to sync external state without useEffect
	if (serializedState && previousStateRef.current !== serializedState) {
		editor.update(() => {
			const nextState = editor.parseEditorState(serializedState);
			editor.setEditorState(nextState);
		});
		previousStateRef.current = serializedState;
	}

	return null;
}
