import { useEffect, useState } from 'react';
import type { NewLexOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { LexicalEditor } from './LexicalEditor';

type LexicalElement = ExcalidrawElement & {
	customData: NewLexOverlayCustomData;
};

interface LexicalNoteProps {
	element: LexicalElement;
	isSelected: boolean;
	onChange: (
		elementId: string,
		updates: {
			lexicalState?: string;
			comments?: NewLexOverlayCustomData['comments'];
			commentsPanelOpen?: boolean;
		},
	) => void;
	onEditingChange?: (isEditing: boolean) => void;
}

const DEFAULT_NEWLEX_CONTENT =
	'{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';

export function LexicalNote({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: LexicalNoteProps) {
	const [isEditing, setIsEditing] = useState(false);

	useEffect(() => {
		onEditingChange?.(isEditing);
		return () => onEditingChange?.(false);
	}, [isEditing, onEditingChange]);

	useEffect(() => {
		if (!isSelected) setIsEditing(false);
	}, [isSelected]);

	return (
		<div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-stone-300 bg-white/95 shadow-xl">
			<div className="flex items-center justify-between border-b border-stone-200 bg-stone-100/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
				<span>Lexical</span>
				<div className="flex items-center gap-2">
					<span className="rounded-full bg-stone-200 px-2 py-1 text-[10px] text-stone-700">
						{element.customData.comments?.length ?? 0} comments
					</span>
					{isSelected && (
						<button
							type="button"
							className="rounded-full border border-stone-300 px-2 py-1 text-[10px] text-stone-700"
							onClick={() => setIsEditing((current) => !current)}
						>
							{isEditing ? 'Read' : 'Edit'}
						</button>
					)}
				</div>
			</div>

			<div className="min-h-0 flex-1" onDoubleClick={() => isSelected && setIsEditing(true)}>
				<LexicalEditor
					namespace={`canvas-note-${element.id}`}
					initialState={element.customData.lexicalState || DEFAULT_NEWLEX_CONTENT}
					readOnly={!isEditing}
					onChange={(lexicalState) => onChange(element.id, { lexicalState })}
				/>
			</div>
		</div>
	);
}
