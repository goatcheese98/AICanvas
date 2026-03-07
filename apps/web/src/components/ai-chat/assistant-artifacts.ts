import type {
	AssistantArtifact,
	KanbanCard,
	KanbanColumn,
	KanbanOverlayCustomData,
} from '@ai-canvas/shared/types';

type KanbanOp =
	| {
			op: 'add_column';
			column: Pick<KanbanColumn, 'id' | 'title'> & Partial<KanbanColumn>;
	  }
	| {
			op: 'add_card';
			columnId: string;
			card: Partial<KanbanCard> & Pick<KanbanCard, 'title'>;
	  };

function createDefaultKanbanBoard(title = 'AI Kanban Board'): KanbanOverlayCustomData {
	return {
		type: 'kanban',
		title,
		bgTheme: 'parchment',
		fontId: 'outfit',
		fontSize: 13,
		columns: [
			{ id: crypto.randomUUID(), title: 'To Do', cards: [] },
			{ id: crypto.randomUUID(), title: 'In Progress', cards: [] },
			{ id: crypto.randomUUID(), title: 'Done', cards: [] },
		],
	};
}

export function buildMarkdownArtifactContent(artifact: AssistantArtifact): string {
	switch (artifact.type) {
		case 'mermaid':
			return ['# Mermaid Draft', '', '```mermaid', artifact.content, '```'].join('\n');
		case 'd2':
			return ['# D2 Draft', '', '```d2', artifact.content, '```'].join('\n');
		case 'kanban-ops':
			return ['# Kanban Operations', '', '```json', artifact.content, '```'].join('\n');
		case 'image':
			return ['# Image Artifact', '', artifact.content].join('\n');
	}
}

export function buildKanbanFromArtifact(artifact: AssistantArtifact): KanbanOverlayCustomData {
	const board = createDefaultKanbanBoard();
	if (artifact.type !== 'kanban-ops') {
		return board;
	}

	let parsed: KanbanOp[] = [];
	try {
		const candidate = JSON.parse(artifact.content);
		if (Array.isArray(candidate)) {
			parsed = candidate as KanbanOp[];
		}
	} catch {
		return board;
	}

	const columns = [...board.columns];

	for (const op of parsed) {
		if (op.op === 'add_column') {
			columns.push({
				id: op.column.id,
				title: op.column.title,
				color: op.column.color,
				wipLimit: op.column.wipLimit,
				cards: Array.isArray(op.column.cards) ? op.column.cards : [],
			});
			continue;
		}

		if (op.op === 'add_card') {
			const targetColumn = columns.find((column) => column.id === op.columnId);
			if (!targetColumn) continue;
			targetColumn.cards.push({
				id: crypto.randomUUID(),
				title: op.card.title,
				description: op.card.description,
				priority: op.card.priority,
				labels: op.card.labels,
				dueDate: op.card.dueDate,
				checklist: op.card.checklist,
			});
		}
	}

	return {
		...board,
		title: columns.some((column) => column.title === 'AI Next') ? 'AI Next Board' : board.title,
		columns,
	};
}
