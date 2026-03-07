import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';

const MAX_HISTORY_ENTRIES = 100;

export const BOARD_FONTS = {
	excalifont: 'Excalifont, Xiaolai, "Segoe UI Emoji", sans-serif',
	'comic-shanns': '"Comic Shanns", "Segoe UI Emoji", cursive',
	'lilita-one': '"Lilita One", "Segoe UI Emoji", sans-serif',
	nunito: 'Nunito, "Segoe UI Emoji", sans-serif',
} as const;

export const BOARD_THEMES = {
	parchment: {
		boardBg: '#f8f2e6',
		headerBg: 'rgba(255,255,255,0.58)',
		columnBg: 'rgba(255,255,255,0.5)',
	},
	white: {
		boardBg: '#ffffff',
		headerBg: '#f5f5f4',
		columnBg: '#fafaf9',
	},
	blue: {
		boardBg: '#eff6ff',
		headerBg: '#dbeafe',
		columnBg: 'rgba(255,255,255,0.72)',
	},
	green: {
		boardBg: '#f0fdf4',
		headerBg: '#dcfce7',
		columnBg: 'rgba(255,255,255,0.72)',
	},
	rose: {
		boardBg: '#fff1f2',
		headerBg: '#ffe4e6',
		columnBg: 'rgba(255,255,255,0.72)',
	},
} as const;

export function cloneKanbanBoard(board: KanbanOverlayCustomData): KanbanOverlayCustomData {
	if (typeof structuredClone === 'function') {
		return structuredClone(board);
	}
	return JSON.parse(JSON.stringify(board)) as KanbanOverlayCustomData;
}

export function normalizeKanbanBoard(board: Partial<KanbanOverlayCustomData> | null | undefined): KanbanOverlayCustomData {
	const columns = Array.isArray(board?.columns) ? board.columns : [];

	return {
		type: 'kanban',
		title: typeof board?.title === 'string' ? board.title : 'Kanban Board',
		bgTheme: typeof board?.bgTheme === 'string' ? board.bgTheme : 'parchment',
		fontId: typeof board?.fontId === 'string' ? board.fontId : 'excalifont',
		fontSize: typeof board?.fontSize === 'number' ? board.fontSize : 13,
		columns: columns.map((column, columnIndex) => ({
			id:
				typeof column?.id === 'string' && column.id.length > 0
					? column.id
					: `column-${columnIndex + 1}`,
			title:
				typeof column?.title === 'string' && column.title.length > 0
					? column.title
					: `Column ${columnIndex + 1}`,
			color: column?.color,
			wipLimit: typeof column?.wipLimit === 'number' ? column.wipLimit : undefined,
			cards: Array.isArray(column?.cards)
				? column.cards.map((card, cardIndex) => ({
						id:
							typeof card?.id === 'string' && card.id.length > 0
								? card.id
								: `card-${columnIndex + 1}-${cardIndex + 1}`,
						title:
							typeof card?.title === 'string' && card.title.length > 0
								? card.title
								: 'Untitled card',
						description: typeof card?.description === 'string' ? card.description : '',
						priority:
							card?.priority === 'low' || card?.priority === 'high' || card?.priority === 'medium'
								? card.priority
								: 'medium',
						labels: Array.isArray(card?.labels) ? card.labels.filter((label): label is string => typeof label === 'string') : [],
						dueDate: typeof card?.dueDate === 'string' ? card.dueDate : undefined,
						checklist: Array.isArray(card?.checklist)
							? card.checklist.map((item) => ({
									text: typeof item?.text === 'string' ? item.text : '',
									done: Boolean(item?.done),
								}))
							: [],
					}))
				: [],
		})),
	};
}

export function moveKanbanCard(
	board: KanbanOverlayCustomData,
	cardId: string,
	toColumnId: string,
	beforeCardId?: string,
): KanbanOverlayCustomData {
	let draggedCard: (typeof board.columns)[number]['cards'][number] | null = null;

	const strippedColumns = board.columns.map((column) => ({
		...column,
		cards: column.cards.filter((card) => {
			if (card.id === cardId) {
				draggedCard = card;
				return false;
			}
			return true;
		}),
	}));

	if (!draggedCard) return board;

	return {
		...board,
		columns: strippedColumns.map((column) => {
			if (column.id !== toColumnId) return column;
			const nextCards = [...column.cards];
			if (!beforeCardId) {
				nextCards.push(draggedCard!);
			} else {
				const targetIndex = nextCards.findIndex((card) => card.id === beforeCardId);
				if (targetIndex === -1) {
					nextCards.push(draggedCard!);
				} else {
					nextCards.splice(targetIndex, 0, draggedCard!);
				}
			}
			return { ...column, cards: nextCards };
		}),
	};
}

export function pushKanbanHistory(
	history: KanbanOverlayCustomData[],
	board: KanbanOverlayCustomData,
): KanbanOverlayCustomData[] {
	return [...history.slice(-(MAX_HISTORY_ENTRIES - 1)), cloneKanbanBoard(board)];
}
