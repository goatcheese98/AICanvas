import { KanbanBoardContainer } from './KanbanBoardContainer';
import { KanbanPreviewCard } from './KanbanPreviewCard';
import type { KanbanBoardProps } from './kanban-board-types';

export function KanbanBoard(props: KanbanBoardProps) {
	if (props.mode === 'preview') {
		return <KanbanPreviewCard element={props.element} isSelected={props.isSelected} />;
	}

	return (
		<KanbanBoardContainer
			element={props.element}
			mode={props.mode}
			isSelected={props.isSelected}
			isActive={props.isActive}
			onChange={props.onChange}
			onActivityChange={props.onActivityChange}
		/>
	);
}
