import { LexicalNoteContainer } from './LexicalNoteContainer';
import { LexicalPreviewCard } from './LexicalPreviewCard';
import type { LexicalNoteProps } from './lexical-note-types';

export function LexicalNote(props: LexicalNoteProps) {
	if (props.mode === 'preview') {
		return <LexicalPreviewCard element={props.element} isSelected={props.isSelected} />;
	}

	return (
		<LexicalNoteContainer
			element={props.element}
			mode={props.mode}
			isSelected={props.isSelected}
			isActive={props.isActive}
			onChange={props.onChange}
			onActivityChange={props.onActivityChange}
		/>
	);
}
