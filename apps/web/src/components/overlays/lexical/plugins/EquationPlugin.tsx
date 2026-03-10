import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_EDITOR,
	createCommand,
	type LexicalCommand,
} from 'lexical';
import { $createEquationNode, EquationNode } from '../nodes/EquationNode';

export const INSERT_EQUATION_COMMAND: LexicalCommand<{
	equation: string;
	inline: boolean;
}> = createCommand('INSERT_EQUATION_COMMAND');

export default function EquationPlugin() {
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		if (!editor.hasNodes([EquationNode])) {
			throw new Error('EquationPlugin: EquationNode not registered on editor');
		}

		return editor.registerCommand(
			INSERT_EQUATION_COMMAND,
			(payload) => {
				const selection = $getSelection();
				if ($isRangeSelection(selection)) {
					selection.insertNodes([$createEquationNode(payload.equation, payload.inline)]);
				}
				return true;
			},
			COMMAND_PRIORITY_EDITOR,
		);
	}, [editor]);

	return null;
}
