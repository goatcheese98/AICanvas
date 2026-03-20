import * as z from 'zod';

export const kanbanChecklistItemSchema = z.object({
	id: z.string().optional(),
	text: z.string().default(''),
	done: z.boolean().default(false),
});

export const kanbanCardSchema = z.object({
	id: z
		.string()
		.trim()
		.min(1)
		.default(() => crypto.randomUUID()),
	title: z
		.string()
		.max(120)
		.refine((value) => value.trim().length > 0, 'Card title must include non-space characters')
		.default('Untitled card'),
	description: z.string().max(2000).default(''),
	priority: z.enum(['low', 'medium', 'high']).default('medium'),
	labels: z.array(z.string().max(200)).default([]),
	dueDate: z.string().optional(),
	checklist: z.array(kanbanChecklistItemSchema).default([]),
});

export const kanbanColumnSchema = z.object({
	id: z
		.string()
		.trim()
		.min(1)
		.default(() => crypto.randomUUID()),
	title: z
		.string()
		.max(80)
		.refine((value) => value.trim().length > 0, 'Column title must include non-space characters')
		.default('Column'),
	color: z.string().optional(),
	cards: z.array(kanbanCardSchema).default([]),
});

export const kanbanOverlaySchema = z.object({
	type: z.literal('kanban'),
	title: z
		.string()
		.max(120)
		.refine((value) => value.trim().length > 0, 'Board title must include non-space characters')
		.default('Kanban Board'),
	columns: z.array(kanbanColumnSchema).default([]),
	bgTheme: z.string().optional(),
	fontId: z.string().optional(),
	fontSize: z.coerce
		.number()
		.transform((value) => Math.min(18, Math.max(12, value)))
		.optional(),
	lastUpdated: z.coerce.number().optional(),
});

const KANBAN_PRIORITY_VALUES = ['low', 'medium', 'high'] as const;

function isKanbanDueDateOverdue(dueDate?: string): boolean {
	if (!dueDate) {
		return false;
	}

	const parsed = new Date(`${dueDate}T23:59:59`);
	if (Number.isNaN(parsed.getTime())) {
		return false;
	}

	return parsed.getTime() < Date.now();
}

export function createStarterKanbanColumns(): z.infer<typeof kanbanOverlaySchema>['columns'] {
	return [
		{
			id: crypto.randomUUID(),
			title: 'To Do',
			color: '#6965db',
			cards: [
				{
					id: crypto.randomUUID(),
					title: 'Capture the goal',
					description: 'Write down what this board is helping you ship before you add more cards.',
					priority: 'medium',
					labels: ['setup'],
					checklist: [
						{ id: crypto.randomUUID(), text: 'Name the outcome', done: false },
						{ id: crypto.randomUUID(), text: 'Note the deadline', done: false },
					],
				},
				{
					id: crypto.randomUUID(),
					title: 'List the next actions',
					description: 'Break the work into concrete cards so the first move is obvious.',
					priority: 'low',
					labels: ['planning'],
					checklist: [],
				},
			],
		},
		{
			id: crypto.randomUUID(),
			title: 'In Progress',
			color: '#c28a42',
			cards: [
				{
					id: crypto.randomUUID(),
					title: 'Shape the first pass',
					description: 'Use this lane for the card you are actively moving right now.',
					priority: 'high',
					labels: ['focus'],
					checklist: [
						{ id: crypto.randomUUID(), text: 'Finish the rough draft', done: true },
						{ id: crypto.randomUUID(), text: 'Review the flow', done: false },
					],
				},
			],
		},
		{
			id: crypto.randomUUID(),
			title: 'Done',
			color: '#557768',
			cards: [
				{
					id: crypto.randomUUID(),
					title: 'Board ready',
					description: 'Keep a finished card here so new boards do not feel empty.',
					priority: 'low',
					labels: ['starter'],
					checklist: [{ id: crypto.randomUUID(), text: 'Starter template loaded', done: true }],
				},
			],
		},
	];
}

export function normalizeKanbanOverlay(
	input?: Partial<z.input<typeof kanbanOverlaySchema>> | null,
): z.infer<typeof kanbanOverlaySchema> {
	const parsed = kanbanOverlaySchema.parse({
		type: 'kanban',
		...(input ?? {}),
	});

	return {
		...parsed,
		columns: parsed.columns.length > 0 ? parsed.columns : createStarterKanbanColumns(),
	};
}

export function summarizeKanbanOverlay(
	input?: Partial<z.input<typeof kanbanOverlaySchema>> | null,
) {
	const board = normalizeKanbanOverlay(input);
	const priorityCounts: Record<(typeof KANBAN_PRIORITY_VALUES)[number], number> = {
		low: 0,
		medium: 0,
		high: 0,
	};
	const labelSet = new Set<string>();
	let cardCount = 0;
	let cardsWithDescriptions = 0;
	let overdueCardCount = 0;
	let completedChecklistItemCount = 0;
	let totalChecklistItemCount = 0;
	let emptyColumnCount = 0;

	const columns = board.columns.map((column) => {
		if (column.cards.length === 0) {
			emptyColumnCount += 1;
		}

		const cards = column.cards.map((card) => {
			cardCount += 1;

			const priority = card.priority ?? 'medium';
			priorityCounts[priority] += 1;

			const hasDescription =
				typeof card.description === 'string' && card.description.trim().length > 0;
			if (hasDescription) {
				cardsWithDescriptions += 1;
			}

			const checklist = Array.isArray(card.checklist) ? card.checklist : [];
			const completedForCard = checklist.filter((item) => item.done).length;
			completedChecklistItemCount += completedForCard;
			totalChecklistItemCount += checklist.length;

			const labels = Array.isArray(card.labels)
				? card.labels.filter(
						(label): label is string => typeof label === 'string' && label.trim().length > 0,
					)
				: [];
			for (const label of labels) {
				labelSet.add(label);
			}

			const isOverdue = isKanbanDueDateOverdue(card.dueDate);
			if (isOverdue) {
				overdueCardCount += 1;
			}

			return {
				id: card.id,
				title: card.title,
				priority,
				labels,
				hasDescription,
				dueDate: card.dueDate,
				isOverdue,
				completedChecklistItemCount: completedForCard,
				totalChecklistItemCount: checklist.length,
			};
		});

		return {
			id: column.id,
			title: column.title,
			cardCount: cards.length,
			cards,
		};
	});

	return {
		title: board.title,
		columnCount: board.columns.length,
		cardCount,
		emptyColumnCount,
		cardsWithDescriptions,
		overdueCardCount,
		completedChecklistItemCount,
		totalChecklistItemCount,
		priorityCounts,
		labels: [...labelSet].sort((left, right) => left.localeCompare(right)),
		columns,
	};
}
