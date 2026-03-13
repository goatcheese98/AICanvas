import {
	normalizeKanbanOverlay,
	normalizeMarkdownOverlay,
	normalizePrototypeOverlay,
} from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifact,
	AssistantKanbanPatchArtifact,
	AssistantMarkdownPatchArtifact,
	KanbanCard,
	KanbanColumn,
	KanbanOverlayCustomData,
	MarkdownOverlayCustomData,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';

interface StoredAssistantAssetContent {
	kind: 'stored_asset';
	r2Key: string;
	mimeType: string;
	provider: string;
	model?: string;
	prompt?: string;
	revisedPrompt?: string;
	tool?: string;
	byteSize?: number;
	sourceArtifactId?: string;
}

interface PrototypeArtifactPayload {
	title?: string;
	template?: PrototypeOverlayCustomData['template'];
	activeFile?: string;
	dependencies?: Record<string, string>;
	preview?: PrototypeOverlayCustomData['preview'];
	files?: PrototypeOverlayCustomData['files'];
	showEditor?: boolean;
	showPreview?: boolean;
	prototype?: PrototypeOverlayCustomData;
}

export interface DiagramArtifactSource {
	language: 'mermaid' | 'd2';
	code: string;
}

type KanbanOp =
	| {
			op: 'add_column';
			column: Pick<KanbanColumn, 'id' | 'title'> & Partial<KanbanColumn>;
	  }
	| {
			op: 'add_card';
			columnId: string;
			card: Partial<KanbanCard> & Pick<KanbanCard, 'title'>;
	  }
	| {
			type: 'add_column';
			id: string;
			title: string;
			position?: number;
			color?: string;
	  }
	| {
			type: 'add_card';
			id?: string;
			column_id: string;
			title: string;
			description?: string;
			priority?: KanbanCard['priority'];
			labels?: string[];
			due_date?: string;
			position?: number;
	  }
	| {
			operation: 'add_column';
			id: string;
			title: string;
			order?: number;
			color?: string;
	  }
	| {
			operation: 'add_card';
			id?: string;
			column_id: string;
			title: string;
			description?: string;
			priority?: KanbanCard['priority'];
			labels?: string[];
			due_date?: string;
	  };
type ExtendedKanbanOp =
	| KanbanOp
	| {
			op: 'update_card';
			column?: string;
			columnId?: string;
			card_index?: number;
			cardIndex?: number;
			updates?: Partial<KanbanCard> & {
				checklist?: Array<string | { text?: string; done?: boolean }>;
			};
	  }
	| {
			op: 'move_card';
			from_column?: string;
			fromColumn?: string;
			to_column?: string;
			toColumn?: string;
			card_index?: number;
			cardIndex?: number;
			target_index?: number;
			targetIndex?: number;
	  };

interface NormalizedKanbanColumn {
	id: string;
	title: string;
	order: number;
	color?: string;
}

interface NormalizedKanbanCard {
	id: string;
	columnId: string;
	title: string;
	description?: string;
	priority?: KanbanCard['priority'];
	labels?: string[];
	dueDate?: string;
	checklist?: KanbanCard['checklist'];
}

function normalizeChecklistItems(
	checklist: unknown,
): KanbanCard['checklist'] {
	if (!Array.isArray(checklist)) {
		return [];
	}

	return checklist
		.map((item) => {
			if (typeof item === 'string') {
				const text = item.trim();
				return text ? { text, done: false } : null;
			}

			if (item && typeof item === 'object') {
				const text =
					typeof (item as { text?: unknown }).text === 'string'
						? (item as { text: string }).text.trim()
						: '';
				if (!text) {
					return null;
				}
				return {
					text,
					done: Boolean((item as { done?: unknown }).done),
				};
			}

			return null;
		})
		.filter(Boolean) as KanbanCard['checklist'];
}

function findColumnByReference(
	columns: KanbanColumn[],
	reference?: string,
): KanbanColumn | undefined {
	if (!reference) {
		return undefined;
	}

	return columns.find((column) => column.id === reference || column.title === reference);
}

export interface MarkdownPatchDiffLine {
	type: 'context' | 'remove' | 'add';
	text: string;
}

export interface MarkdownPatchHunk {
	id: string;
	baseStart: number;
	baseEnd: number;
	addedLineCount: number;
	removedLineCount: number;
	nextLines: string[];
	lines: MarkdownPatchDiffLine[];
}

export type MarkdownPatchConflictState = 'clean' | 'modified' | 'already-applied';

interface MarkdownDiffChunk {
	type: 'equal' | 'remove' | 'add';
	lines: string[];
}

function createDefaultKanbanBoard(title = 'AI Kanban Board'): KanbanOverlayCustomData {
	return {
		type: 'kanban',
		title,
		columns: [
			{ id: crypto.randomUUID(), title: 'To Do', cards: [] },
			{ id: crypto.randomUUID(), title: 'In Progress', cards: [] },
			{ id: crypto.randomUUID(), title: 'Done', cards: [] },
		],
	};
}

export function parseStoredAssistantAssetContent(content: string): StoredAssistantAssetContent | null {
	try {
		const parsed = JSON.parse(content) as StoredAssistantAssetContent;
		return parsed.kind === 'stored_asset' ? parsed : null;
	} catch {
		return null;
	}
}

export function describeAssistantArtifact(artifact: AssistantArtifact): string {
	const storedAsset = parseStoredAssistantAssetContent(artifact.content);
	if (!storedAsset) {
		return artifact.content;
	}

	const lines = [
		`Provider: ${storedAsset.provider}`,
		storedAsset.model ? `Model: ${storedAsset.model}` : storedAsset.tool ? `Tool: ${storedAsset.tool}` : null,
		storedAsset.mimeType ? `MIME: ${storedAsset.mimeType}` : null,
		storedAsset.prompt ? `Prompt: ${storedAsset.prompt}` : null,
		storedAsset.revisedPrompt ? `Revised prompt: ${storedAsset.revisedPrompt}` : null,
	];

	return lines.filter(Boolean).join('\n');
}

export function buildMarkdownArtifactContent(artifact: AssistantArtifact): string {
	switch (artifact.type) {
		case 'mermaid':
			return ['# Mermaid Draft', '', '```mermaid', artifact.content, '```'].join('\n');
		case 'd2':
			return ['# D2 Draft', '', '```d2', artifact.content, '```'].join('\n');
		case 'markdown':
			return artifact.content;
		case 'layout-plan':
			return ['# Layout Plan', '', '```json', artifact.content, '```'].join('\n');
		case 'image-vector':
			return ['# Vectorized Asset', '', describeAssistantArtifact(artifact)].join('\n');
		case 'kanban-ops':
			return ['# Kanban Operations', '', '```json', artifact.content, '```'].join('\n');
		case 'prototype-files':
			return ['# Prototype Files', '', '```json', artifact.content, '```'].join('\n');
		case 'markdown-patch':
		case 'kanban-patch':
			return ['# Patch Artifact', '', '```json', artifact.content, '```'].join('\n');
		case 'image':
			return ['# Image Artifact', '', describeAssistantArtifact(artifact)].join('\n');
	}
}

export function parseMarkdownPatchArtifact(
	artifact: AssistantArtifact,
): AssistantMarkdownPatchArtifact | null {
	if (artifact.type !== 'markdown-patch') {
		return null;
	}

	try {
		const parsed = JSON.parse(artifact.content) as AssistantMarkdownPatchArtifact;
		if (parsed.kind !== 'markdown_patch' || typeof parsed.targetId !== 'string') {
			return null;
		}
		return {
			...parsed,
			base: {
				title: parsed.base?.title,
				content: parsed.base?.content ?? '',
			},
			next: {
				title: parsed.next?.title,
				content: parsed.next?.content ?? '',
				images: parsed.next?.images,
				settings: parsed.next?.settings,
				editorMode: parsed.next?.editorMode,
			},
		};
	} catch {
		return null;
	}
}

export function parseKanbanPatchArtifact(
	artifact: AssistantArtifact,
): AssistantKanbanPatchArtifact | null {
	if (artifact.type !== 'kanban-patch') {
		return null;
	}

	try {
		const parsed = JSON.parse(artifact.content) as AssistantKanbanPatchArtifact;
		if (parsed.kind !== 'kanban_patch' || typeof parsed.targetId !== 'string') {
			return null;
		}
		return {
			...parsed,
			base: normalizeKanbanOverlay(parsed.base),
			next: normalizeKanbanOverlay(parsed.next),
			operations: Array.isArray(parsed.operations) ? parsed.operations : [],
		};
	} catch {
		return null;
	}
}

function normalizeMarkdownPatchContent(content: string): string {
	return content.replace(/\r\n/g, '\n');
}

function buildMarkdownDiffChunks(baseLines: string[], nextLines: string[]): MarkdownDiffChunk[] {
	const lcs: number[][] = Array.from({ length: baseLines.length + 1 }, () =>
		Array(nextLines.length + 1).fill(0),
	);

	for (let baseIndex = baseLines.length - 1; baseIndex >= 0; baseIndex -= 1) {
		for (let nextIndex = nextLines.length - 1; nextIndex >= 0; nextIndex -= 1) {
			lcs[baseIndex]![nextIndex] =
				baseLines[baseIndex] === nextLines[nextIndex]
					? (lcs[baseIndex + 1]?.[nextIndex + 1] ?? 0) + 1
					: Math.max(lcs[baseIndex + 1]?.[nextIndex] ?? 0, lcs[baseIndex]?.[nextIndex + 1] ?? 0);
		}
	}

	const chunks: MarkdownDiffChunk[] = [];
	const pushChunk = (type: MarkdownDiffChunk['type'], line: string) => {
		const previous = chunks[chunks.length - 1];
		if (previous?.type === type) {
			previous.lines.push(line);
			return;
		}
		chunks.push({ type, lines: [line] });
	};

	let baseIndex = 0;
	let nextIndex = 0;
	while (baseIndex < baseLines.length && nextIndex < nextLines.length) {
		if (baseLines[baseIndex] === nextLines[nextIndex]) {
			pushChunk('equal', baseLines[baseIndex] ?? '');
			baseIndex += 1;
			nextIndex += 1;
			continue;
		}

		if ((lcs[baseIndex + 1]?.[nextIndex] ?? 0) >= (lcs[baseIndex]?.[nextIndex + 1] ?? 0)) {
			pushChunk('remove', baseLines[baseIndex] ?? '');
			baseIndex += 1;
			continue;
		}

		pushChunk('add', nextLines[nextIndex] ?? '');
		nextIndex += 1;
	}

	while (baseIndex < baseLines.length) {
		pushChunk('remove', baseLines[baseIndex] ?? '');
		baseIndex += 1;
	}

	while (nextIndex < nextLines.length) {
		pushChunk('add', nextLines[nextIndex] ?? '');
		nextIndex += 1;
	}

	return chunks;
}

export function buildMarkdownPatchHunks(
	base: Pick<MarkdownOverlayCustomData, 'content'>,
	next: Pick<MarkdownOverlayCustomData, 'content'>,
	contextLineCount = 2,
): MarkdownPatchHunk[] {
	const baseLines = normalizeMarkdownPatchContent(base.content).split('\n');
	const nextLines = normalizeMarkdownPatchContent(next.content).split('\n');
	const chunks = buildMarkdownDiffChunks(baseLines, nextLines);
	const hunks: MarkdownPatchHunk[] = [];

	let chunkIndex = 0;
	let baseCursor = 0;
	let nextCursor = 0;
	let previousEqualLines: string[] = [];

	while (chunkIndex < chunks.length) {
		const chunk = chunks[chunkIndex];
		if (!chunk) {
			break;
		}

		if (chunk.type === 'equal') {
			baseCursor += chunk.lines.length;
			nextCursor += chunk.lines.length;
			previousEqualLines = chunk.lines;
			chunkIndex += 1;
			continue;
		}

		const baseStart = baseCursor;
		const lines: MarkdownPatchDiffLine[] = previousEqualLines
			.slice(-contextLineCount)
			.map((line) => ({ type: 'context' as const, text: line }));
		const nextHunkLines: string[] = [];
		let removedLineCount = 0;
		let addedLineCount = 0;

		while (chunkIndex < chunks.length && chunks[chunkIndex]?.type !== 'equal') {
			const currentChunk = chunks[chunkIndex];
			if (!currentChunk) {
				break;
			}

			if (currentChunk.type === 'remove') {
				for (const line of currentChunk.lines) {
					lines.push({ type: 'remove', text: line });
				}
				baseCursor += currentChunk.lines.length;
				removedLineCount += currentChunk.lines.length;
			} else {
				for (const line of currentChunk.lines) {
					lines.push({ type: 'add', text: line });
					nextHunkLines.push(line);
				}
				nextCursor += currentChunk.lines.length;
				addedLineCount += currentChunk.lines.length;
			}

			chunkIndex += 1;
		}

		const trailingEqualLines = chunks[chunkIndex]?.type === 'equal' ? chunks[chunkIndex]?.lines ?? [] : [];
		for (const line of trailingEqualLines.slice(0, contextLineCount)) {
			lines.push({ type: 'context', text: line });
		}

		const baseEnd = baseCursor;
		hunks.push({
			id: `hunk-${baseStart}-${baseEnd}-${nextCursor}-${hunks.length + 1}`,
			baseStart,
			baseEnd,
			addedLineCount,
			removedLineCount,
			nextLines: nextHunkLines,
			lines,
		});
		previousEqualLines = trailingEqualLines;
	}

	return hunks;
}

export function buildMarkdownPatchDiff(
	base: Pick<MarkdownOverlayCustomData, 'content'>,
	next: Pick<MarkdownOverlayCustomData, 'content'>,
): MarkdownPatchDiffLine[] {
	const hunks = buildMarkdownPatchHunks(base, next);
	if (hunks.length === 0) {
		return [{ type: 'context', text: normalizeMarkdownPatchContent(next.content) }];
	}

	return hunks.flatMap((hunk) => hunk.lines);
}

export function applyAcceptedMarkdownPatchHunks(
	baseContent: string,
	hunks: MarkdownPatchHunk[],
	acceptedHunkIds: readonly string[],
): string {
	const baseLines = normalizeMarkdownPatchContent(baseContent).split('\n');
	const acceptedHunkIdSet = new Set(acceptedHunkIds);
	const orderedHunks = [...hunks].sort((left, right) => left.baseStart - right.baseStart);
	const mergedLines: string[] = [];
	let cursor = 0;

	for (const hunk of orderedHunks) {
		mergedLines.push(...baseLines.slice(cursor, hunk.baseStart));
		if (acceptedHunkIdSet.has(hunk.id)) {
			mergedLines.push(...hunk.nextLines);
		} else {
			mergedLines.push(...baseLines.slice(hunk.baseStart, hunk.baseEnd));
		}
		cursor = hunk.baseEnd;
	}

	mergedLines.push(...baseLines.slice(cursor));
	return mergedLines.join('\n');
}

export function detectMarkdownPatchConflict(
	currentContent: string,
	baseContent: string,
	nextContent?: string,
): MarkdownPatchConflictState {
	const normalizedCurrentContent = normalizeMarkdownPatchContent(currentContent);
	const normalizedBaseContent = normalizeMarkdownPatchContent(baseContent);
	const normalizedNextContent = nextContent ? normalizeMarkdownPatchContent(nextContent) : null;

	if (normalizedCurrentContent === normalizedBaseContent) {
		return 'clean';
	}

	if (normalizedNextContent !== null && normalizedCurrentContent === normalizedNextContent) {
		return 'already-applied';
	}

	return 'modified';
}

export function summarizeKanbanPatchChanges(
	patch: AssistantKanbanPatchArtifact,
): string[] {
	const changes: string[] = [];
	const baseColumnsById = new Map(patch.base.columns.map((column) => [column.id, column]));

	for (const column of patch.next.columns) {
		const previous = baseColumnsById.get(column.id);
		if (!previous) {
			changes.push(`Add column "${column.title}"`);
			continue;
		}

		if (column.title !== previous.title) {
			changes.push(`Rename column "${previous.title}" to "${column.title}"`);
		}

		const previousCardIds = new Set(previous.cards.map((card) => card.id));
		for (const card of column.cards) {
			if (!previousCardIds.has(card.id)) {
				changes.push(`Add card "${card.title}" to "${column.title}"`);
			}
		}
	}

	return changes.length > 0 ? changes : ['Update selected kanban board'];
}

export function buildPrototypeFromArtifact(
	artifact: AssistantArtifact,
): PrototypeOverlayCustomData {
	if (artifact.type !== 'prototype-files') {
		return normalizePrototypeOverlay();
	}

	try {
		const parsed = JSON.parse(artifact.content) as PrototypeArtifactPayload;
		return normalizePrototypeOverlay(
			(typeof parsed.prototype === 'object' && parsed.prototype !== null ? parsed.prototype : parsed) as
				| PrototypeOverlayCustomData
				| PrototypeArtifactPayload,
		);
	} catch {
		return normalizePrototypeOverlay();
	}
}

function extractCodeBlock(content: string, language: string): string | null {
	const pattern = new RegExp(`\`\`\`${language}\\s*\\n([\\s\\S]*?)\\n\`\`\``, 'i');
	const match = content.match(pattern);
	return match?.[1]?.trim() || null;
}

function normalizeDiagramCode(code: string): string {
	return code
		.split('\n')
		.map((line) => line.trimEnd())
		.join('\n')
		.trim();
}

export function getDiagramArtifactSource(
	artifact: AssistantArtifact,
): DiagramArtifactSource | null {
	if (artifact.type === 'mermaid' || artifact.type === 'd2') {
		return {
			language: artifact.type,
			code: normalizeDiagramCode(artifact.content),
		};
	}

	if (artifact.type !== 'markdown') {
		return null;
	}

	const mermaidCode = extractCodeBlock(artifact.content, 'mermaid');
	if (mermaidCode) {
		return {
			language: 'mermaid',
			code: normalizeDiagramCode(mermaidCode),
		};
	}

	const d2Code = extractCodeBlock(artifact.content, 'd2');
	if (d2Code) {
		return {
			language: 'd2',
			code: normalizeDiagramCode(d2Code),
		};
	}

	return null;
}

export function filterVisibleArtifacts(artifacts: AssistantArtifact[]): AssistantArtifact[] {
	const nativeDiagramLanguages = new Set(
		artifacts.flatMap((artifact) =>
			artifact.type === 'mermaid' || artifact.type === 'd2' ? [artifact.type] : [],
		),
	);
	const nativeDiagramKeys = new Set(
		artifacts.flatMap((artifact) => {
			if (artifact.type !== 'mermaid' && artifact.type !== 'd2') {
				return [];
			}

			const diagram = getDiagramArtifactSource(artifact);
			return diagram ? [`${diagram.language}:${diagram.code}`] : [];
		}),
	);
	const seenDiagramKeys = new Set<string>();

	return artifacts.filter((artifact) => {
		if (artifact.type === 'layout-plan') {
			return false;
		}

		const diagram = getDiagramArtifactSource(artifact);
		if (!diagram) {
			return true;
		}

		const key = `${diagram.language}:${diagram.code}`;
		if (
			artifact.type === 'markdown' &&
			(nativeDiagramLanguages.has(diagram.language) || nativeDiagramKeys.has(key))
		) {
			return false;
		}

		if (seenDiagramKeys.has(key)) {
			return false;
		}

		seenDiagramKeys.add(key);
		return true;
	});
}

export function buildPrototypeFromMessageContent(
	content: string,
): PrototypeOverlayCustomData | null {
	const html = extractCodeBlock(content, 'html');
	const css = extractCodeBlock(content, 'css');
	const javascript = extractCodeBlock(content, 'javascript') ?? extractCodeBlock(content, 'js');
	const jsx = extractCodeBlock(content, 'jsx') ?? extractCodeBlock(content, 'tsx');

	if (html && css && javascript) {
		return normalizePrototypeOverlay({
			title: 'Vanilla JS Prototype',
			template: 'vanilla',
			activeFile: '/index.js',
			files: {
				'/index.html': { code: html, hidden: true },
				'/index.js': { code: javascript },
				'/styles.css': { code: css },
			},
		});
	}

	if (jsx && css) {
		return normalizePrototypeOverlay({
			title: 'React Prototype',
			template: 'react',
			activeFile: '/App.jsx',
			files: {
				'/App.jsx': { code: jsx },
				'/index.jsx': {
					code:
						"import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './styles.css';\n\nimport App from './App';\n\nconst container = document.getElementById('root');\n\nif (container) {\n  const root = createRoot(container);\n  root.render(\n    <StrictMode>\n      <App />\n    </StrictMode>\n  );\n}\n",
					hidden: true,
				},
				'/styles.css': { code: css },
			},
		});
	}

	return null;
}

export function buildKanbanFromArtifact(
	artifact: AssistantArtifact,
	baseBoard?: KanbanOverlayCustomData,
): KanbanOverlayCustomData {
	const board = normalizeKanbanOverlay(baseBoard ?? createDefaultKanbanBoard());
	if (artifact.type === 'kanban-patch') {
		return parseKanbanPatchArtifact(artifact)?.next ?? board;
	}

	if (artifact.type !== 'kanban-ops') {
		return board;
	}

	let parsed: ExtendedKanbanOp[] = [];
	try {
		const candidate = JSON.parse(artifact.content) as
			| ExtendedKanbanOp[]
			| { operations?: ExtendedKanbanOp[] }
			| KanbanOverlayCustomData;
		if (Array.isArray(candidate)) {
			parsed = candidate;
		} else if (
			candidate &&
			typeof candidate === 'object' &&
			'operations' in candidate &&
			Array.isArray(candidate.operations)
		) {
			parsed = candidate.operations;
		} else if (
			candidate &&
			typeof candidate === 'object' &&
			'columns' in candidate &&
			Array.isArray((candidate as { columns?: unknown }).columns)
		) {
			return normalizeKanbanOverlay(candidate as KanbanOverlayCustomData);
		}
	} catch {
		return board;
	}

	const workingBoard = normalizeKanbanOverlay(board);
	const normalizedColumns: NormalizedKanbanColumn[] = [];
	const normalizedCards: NormalizedKanbanCard[] = [];

	for (const [index, op] of parsed.entries()) {
		if ('op' in op && op.op === 'add_column') {
			normalizedColumns.push({
				id: op.column.id,
				title: op.column.title,
				order: index,
				color: op.column.color,
			});
			continue;
		}

		if ('operation' in op && op.operation === 'add_column') {
			normalizedColumns.push({
				id: op.id,
				title: op.title,
				order: op.order ?? index,
				color: op.color,
			});
			continue;
		}

		if ('type' in op && op.type === 'add_column') {
			normalizedColumns.push({
				id: op.id,
				title: op.title,
				order: op.position ?? index,
				color: op.color,
			});
			continue;
		}

		if ('op' in op && op.op === 'add_card') {
			normalizedCards.push({
				id: crypto.randomUUID(),
				columnId: op.columnId,
				title: op.card.title,
				description: op.card.description,
				priority: op.card.priority,
				labels: op.card.labels,
				dueDate: op.card.dueDate,
				checklist: normalizeChecklistItems(op.card.checklist),
			});
			continue;
		}

		if ('type' in op && op.type === 'add_card') {
			normalizedCards.push({
				id: op.id ?? crypto.randomUUID(),
				columnId: op.column_id,
				title: op.title,
				description: op.description,
				priority: op.priority,
				labels: op.labels,
				dueDate: op.due_date,
				checklist: [],
			});
			continue;
		}

		if ('operation' in op && op.operation === 'add_card') {
			normalizedCards.push({
				id: op.id ?? crypto.randomUUID(),
				columnId: op.column_id,
				title: op.title,
				description: op.description,
				priority: op.priority,
				labels: op.labels,
				dueDate: op.due_date,
				checklist: [],
			});
			continue;
		}

		if ('op' in op && op.op === 'update_card') {
			const column = findColumnByReference(workingBoard.columns, op.columnId ?? op.column);
			const cardIndex = op.cardIndex ?? op.card_index ?? -1;
			if (!column || cardIndex < 0 || cardIndex >= column.cards.length) {
				continue;
			}
			const existingCard = column.cards[cardIndex];
			if (!existingCard) {
				continue;
			}
			column.cards[cardIndex] = {
				...existingCard,
				...op.updates,
				checklist:
					op.updates?.checklist != null
						? normalizeChecklistItems(op.updates.checklist)
						: normalizeChecklistItems(existingCard.checklist),
			};
			continue;
		}

		if ('op' in op && op.op === 'move_card') {
			const fromColumn = findColumnByReference(workingBoard.columns, op.fromColumn ?? op.from_column);
			const toColumn = findColumnByReference(workingBoard.columns, op.toColumn ?? op.to_column);
			const cardIndex = op.cardIndex ?? op.card_index ?? -1;
			const targetIndex = op.targetIndex ?? op.target_index ?? -1;
			if (!fromColumn || !toColumn || cardIndex < 0 || cardIndex >= fromColumn.cards.length) {
				continue;
			}
			const [movedCard] = fromColumn.cards.splice(cardIndex, 1);
			if (!movedCard) {
				continue;
			}
			if (targetIndex >= 0 && targetIndex <= toColumn.cards.length) {
				toColumn.cards.splice(targetIndex, 0, movedCard);
			} else {
				toColumn.cards.push(movedCard);
			}
		}
	}

	const baseColumns =
		normalizedColumns.length > 0
			? normalizedColumns
					.sort((left, right) => left.order - right.order)
					.map<KanbanColumn>((column) => ({
						id: column.id,
						title: column.title,
						color: column.color,
						cards: [],
					}))
			: [...workingBoard.columns];

	for (const card of normalizedCards) {
		const targetColumn = baseColumns.find((column) => column.id === card.columnId);
		if (!targetColumn) {
			continue;
		}

		targetColumn.cards.push({
			id: card.id,
			title: card.title,
			description: card.description,
			priority: card.priority,
			labels: card.labels,
			dueDate: card.dueDate,
			checklist: normalizeChecklistItems(card.checklist),
		});
	}

	return normalizeKanbanOverlay({
		...workingBoard,
		title: baseColumns.some((column) => column.title === 'AI Next') ? 'AI Next Board' : workingBoard.title,
		columns: baseColumns,
	});
}
