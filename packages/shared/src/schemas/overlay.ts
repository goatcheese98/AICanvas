import * as z from 'zod';
import { OVERLAY_TYPES } from '../constants';
import type { OverlayCustomData } from '../types';
import {
	normalizePrototypeOverlay,
	prototypeOverlaySchema,
} from './overlay-prototype';
export {
	prototypeCardMetricSchema,
	prototypeCardPreviewSchema,
	prototypeOverlayFileSchema,
	prototypeOverlaySchema,
	normalizePrototypeOverlay,
	prototypeTemplateSchema,
} from './overlay-prototype';


export const MARKDOWN_SYSTEM_FONT_STACK =
	'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const DEFAULT_MARKDOWN_NOTE_SETTINGS = {
	font: 'Nunito, "Segoe UI Emoji", sans-serif',
	fontSize: 8,
	background: '#ffffff',
	lineHeight: 1.65,
	inlineCodeColor: '#334155',
	showEmptyLines: true,
	autoHideToolbar: false,
} as const;

export const markdownEditorModeSchema = z.enum(['raw', 'hybrid']);

export const markdownNoteSettingsSchema = z.object({
	font: z.string().trim().min(1).max(160).default(DEFAULT_MARKDOWN_NOTE_SETTINGS.font),
	fontSize: z.coerce
		.number()
		.transform((value) => Math.min(28, Math.max(8, value)))
		.default(DEFAULT_MARKDOWN_NOTE_SETTINGS.fontSize),
	background: z.string().trim().min(1).max(32).default(DEFAULT_MARKDOWN_NOTE_SETTINGS.background),
	lineHeight: z.coerce
		.number()
		.transform((value) => Math.min(2.2, Math.max(1.2, value)))
		.default(DEFAULT_MARKDOWN_NOTE_SETTINGS.lineHeight),
	inlineCodeColor: z
		.string()
		.trim()
		.regex(/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/)
		.default(DEFAULT_MARKDOWN_NOTE_SETTINGS.inlineCodeColor),
	showEmptyLines: z.coerce.boolean().default(DEFAULT_MARKDOWN_NOTE_SETTINGS.showEmptyLines),
	autoHideToolbar: z.coerce.boolean().default(DEFAULT_MARKDOWN_NOTE_SETTINGS.autoHideToolbar),
});

export const markdownOverlaySchema = z.object({
	type: z.literal('markdown'),
	title: z.string().trim().min(1).max(8).default('Markdown'),
	content: z.string().default(''),
	images: z.record(z.string(), z.string()).optional(),
	settings: markdownNoteSettingsSchema.optional(),
	editorMode: markdownEditorModeSchema.optional(),
});

export const newLexCommentReplySchema = z.object({
	id: z
		.string()
		.trim()
		.min(1)
		.default(() => crypto.randomUUID()),
	author: z.string().trim().min(1).default('You'),
	message: z.string().default(''),
	createdAt: z.coerce.number().default(() => Date.now()),
	deleted: z.boolean().optional(),
});

export const newLexCommentThreadSchema = z.object({
	id: z
		.string()
		.trim()
		.min(1)
		.default(() => crypto.randomUUID()),
	author: z.string().trim().min(1).default('You'),
	comment: z.string().default(''),
	commentDeleted: z.boolean().optional(),
	anchorText: z.string().default(''),
	createdAt: z.coerce.number().default(() => Date.now()),
	resolved: z.boolean().default(false),
	collapsed: z.boolean().default(false),
	replies: z.array(newLexCommentReplySchema).default([]),
});

export const newLexOverlaySchema = z.object({
	type: z.literal('newlex'),
	title: z.string().trim().min(1).max(32).default('Rich Text'),
	lexicalState: z.string().default(''),
	comments: z.array(newLexCommentThreadSchema).optional(),
	commentsPanelOpen: z.boolean().optional(),
	version: z.coerce.number().default(1),
});

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

export const webEmbedOverlaySchema = z.object({
	type: z.literal('web-embed'),
	url: z.string().default(''),
});


export const overlayCustomDataSchema = z.discriminatedUnion('type', [
	markdownOverlaySchema,
	newLexOverlaySchema,
	kanbanOverlaySchema,
	webEmbedOverlaySchema,
	prototypeOverlaySchema,
]);

export function normalizeMarkdownSettings(
	settings?: Partial<z.input<typeof markdownNoteSettingsSchema>> | null,
) {
	const parsed = markdownNoteSettingsSchema.parse(settings ?? {});
	return {
		...parsed,
		font: parsed.font === 'inherit' ? MARKDOWN_SYSTEM_FONT_STACK : parsed.font,
	};
}

export function normalizeMarkdownOverlay(
	input?: Partial<z.input<typeof markdownOverlaySchema>> | null,
) {
	const parsed = markdownOverlaySchema.parse({
		type: 'markdown',
		...(input ?? {}),
	});

	return {
		...parsed,
		settings: normalizeMarkdownSettings(parsed.settings),
		editorMode: parsed.editorMode ?? 'raw',
	};
}

export function normalizeNewLexOverlay(
	input?: Partial<z.input<typeof newLexOverlaySchema>> | null,
) {
	const parsed = newLexOverlaySchema.parse({
		type: 'newlex',
		...(input ?? {}),
	});

	return {
		...parsed,
		comments: parsed.comments ?? [],
		commentsPanelOpen: parsed.commentsPanelOpen ?? false,
	};
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

export function normalizeWebEmbedOverlay(
	input?: Partial<z.input<typeof webEmbedOverlaySchema>> | null,
) {
	return webEmbedOverlaySchema.parse({
		type: 'web-embed',
		...(input ?? {}),
	});
}


export function normalizeOverlayCustomData(
	input?: Partial<OverlayCustomData> | Record<string, unknown> | null,
): OverlayCustomData {
	const type = input?.type;
	if (type === 'markdown') return normalizeMarkdownOverlay(input);
	if (type === 'newlex') return normalizeNewLexOverlay(input);
	if (type === 'kanban') return normalizeKanbanOverlay(input);
	if (type === 'web-embed') return normalizeWebEmbedOverlay(input);
	if (type === 'prototype') return normalizePrototypeOverlay(input);
	return normalizeMarkdownOverlay();
}

export function isOverlayCustomData(value: unknown): value is OverlayCustomData {
	if (!value || typeof value !== 'object') return false;
	const type = (value as { type?: unknown }).type;
	return typeof type === 'string' && (OVERLAY_TYPES as readonly string[]).includes(type);
}

export const overlaySchemas = {
	markdown: markdownOverlaySchema,
	markdownSettings: markdownNoteSettingsSchema,
	markdownEditorMode: markdownEditorModeSchema,
	newLex: newLexOverlaySchema,
	kanban: kanbanOverlaySchema,
	webEmbed: webEmbedOverlaySchema,
	prototype: prototypeOverlaySchema,
	customData: overlayCustomDataSchema,
} as const;

export type MarkdownNoteSettingsInput = z.input<typeof markdownNoteSettingsSchema>;
export type MarkdownOverlayInput = z.input<typeof markdownOverlaySchema>;
