import {
	FORMAT_ELEMENT_COMMAND,
	FORMAT_TEXT_COMMAND,
	REDO_COMMAND,
	UNDO_COMMAND,
} from 'lexical';
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

const buttonClass =
	'rounded-full border border-stone-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700 hover:bg-stone-100';

export function LexicalToolbar() {
	const [editor] = useLexicalComposerContext();

	return (
		<div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-100/85 px-3 py-2">
			<button type="button" className={buttonClass} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>
				Undo
			</button>
			<button type="button" className={buttonClass} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>
				Redo
			</button>
			<button type="button" className={buttonClass} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}>
				Bold
			</button>
			<button type="button" className={buttonClass} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}>
				Italic
			</button>
			<button type="button" className={buttonClass} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}>
				Underline
			</button>
			<button
				type="button"
				className={buttonClass}
				onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
			>
				Strike
			</button>
			<button
				type="button"
				className={buttonClass}
				onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
			>
				Code
			</button>
			<button
				type="button"
				className={buttonClass}
				onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
			>
				Bullets
			</button>
			<button
				type="button"
				className={buttonClass}
				onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
			>
				Numbers
			</button>
			<button
				type="button"
				className={buttonClass}
				onClick={() => {
					const url = window.prompt('Link URL');
					if (url) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
				}}
			>
				Link
			</button>
			<button
				type="button"
				className={buttonClass}
				onClick={() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)}
			>
				Unlink
			</button>
			<button
				type="button"
				className={buttonClass}
				onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}
			>
				Center
			</button>
		</div>
	);
}
