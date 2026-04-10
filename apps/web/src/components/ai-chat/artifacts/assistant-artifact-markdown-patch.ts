import type {
	AssistantArtifact,
	AssistantMarkdownPatchArtifact,
	MarkdownOverlayCustomData,
} from '@ai-canvas/shared/types';
import { normalizeLineEndings } from './assistant-artifact-text';

interface MarkdownPatchDiffLine {
	type: 'context' | 'remove' | 'add';
	text: string;
}

interface MarkdownPatchHunk {
	id: string;
	baseStart: number;
	baseEnd: number;
	addedLineCount: number;
	removedLineCount: number;
	nextLines: string[];
	lines: MarkdownPatchDiffLine[];
}

type MarkdownPatchConflictState = 'clean' | 'modified' | 'already-applied';

interface MarkdownDiffChunk {
	type: 'equal' | 'remove' | 'add';
	lines: string[];
}

interface MarkdownPatchHunkDraft {
	lines: MarkdownPatchDiffLine[];
	nextLines: string[];
	addedLineCount: number;
	removedLineCount: number;
}

interface MarkdownPatchHunkReadResult {
	baseCursor: number;
	chunkIndex: number;
	hunk: MarkdownPatchHunk;
	nextCursor: number;
	previousEqualLines: string[];
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

function buildMarkdownDiffChunks(baseLines: string[], nextLines: string[]): MarkdownDiffChunk[] {
	const chunks: MarkdownDiffChunk[] = [];
	const lcs = buildMarkdownLcsTable(baseLines, nextLines);

	let baseIndex = 0;
	let nextIndex = 0;
	while (baseIndex < baseLines.length && nextIndex < nextLines.length) {
		if (baseLines[baseIndex] === nextLines[nextIndex]) {
			appendMarkdownDiffChunk(chunks, 'equal', baseLines[baseIndex] ?? '');
			baseIndex += 1;
			nextIndex += 1;
			continue;
		}

		if ((lcs[baseIndex + 1]?.[nextIndex] ?? 0) >= (lcs[baseIndex]?.[nextIndex + 1] ?? 0)) {
			appendMarkdownDiffChunk(chunks, 'remove', baseLines[baseIndex] ?? '');
			baseIndex += 1;
			continue;
		}

		appendMarkdownDiffChunk(chunks, 'add', nextLines[nextIndex] ?? '');
		nextIndex += 1;
	}

	appendRemainingMarkdownDiffLines(chunks, 'remove', baseLines, baseIndex);
	appendRemainingMarkdownDiffLines(chunks, 'add', nextLines, nextIndex);

	return chunks;
}

export function buildMarkdownPatchHunks(
	base: Pick<MarkdownOverlayCustomData, 'content'>,
	next: Pick<MarkdownOverlayCustomData, 'content'>,
	contextLineCount = 2,
): MarkdownPatchHunk[] {
	const baseLines = normalizeLineEndings(base.content).split('\n');
	const nextLines = normalizeLineEndings(next.content).split('\n');
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
			({ baseCursor, nextCursor, previousEqualLines } = consumeEqualMarkdownChunk(
				chunk,
				baseCursor,
				nextCursor,
			));
			chunkIndex += 1;
			continue;
		}

		const hunkResult = readMarkdownPatchHunk(
			chunks,
			chunkIndex,
			baseCursor,
			nextCursor,
			previousEqualLines,
			contextLineCount,
			hunks.length,
		);
		hunks.push(hunkResult.hunk);
		baseCursor = hunkResult.baseCursor;
		chunkIndex = hunkResult.chunkIndex;
		nextCursor = hunkResult.nextCursor;
		previousEqualLines = hunkResult.previousEqualLines;
	}

	return hunks;
}

export function buildMarkdownPatchDiff(
	base: Pick<MarkdownOverlayCustomData, 'content'>,
	next: Pick<MarkdownOverlayCustomData, 'content'>,
): MarkdownPatchDiffLine[] {
	const hunks = buildMarkdownPatchHunks(base, next);
	if (hunks.length === 0) {
		return [{ type: 'context', text: normalizeLineEndings(next.content) }];
	}

	return hunks.flatMap((hunk) => hunk.lines);
}

export function applyAcceptedMarkdownPatchHunks(
	baseContent: string,
	hunks: MarkdownPatchHunk[],
	acceptedHunkIds: readonly string[],
): string {
	const baseLines = normalizeLineEndings(baseContent).split('\n');
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
	const normalizedCurrentContent = normalizeLineEndings(currentContent);
	const normalizedBaseContent = normalizeLineEndings(baseContent);
	const normalizedNextContent = nextContent ? normalizeLineEndings(nextContent) : null;

	if (normalizedCurrentContent === normalizedBaseContent) {
		return 'clean';
	}

	if (normalizedNextContent !== null && normalizedCurrentContent === normalizedNextContent) {
		return 'already-applied';
	}

	return 'modified';
}

function buildMarkdownLcsTable(baseLines: string[], nextLines: string[]): number[][] {
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

	return lcs;
}

function appendMarkdownDiffChunk(
	chunks: MarkdownDiffChunk[],
	type: MarkdownDiffChunk['type'],
	line: string,
) {
	const previous = chunks[chunks.length - 1];
	if (previous?.type === type) {
		previous.lines.push(line);
		return;
	}

	chunks.push({ type, lines: [line] });
}

function appendRemainingMarkdownDiffLines(
	chunks: MarkdownDiffChunk[],
	type: Extract<MarkdownDiffChunk['type'], 'remove' | 'add'>,
	lines: string[],
	startIndex: number,
) {
	for (let index = startIndex; index < lines.length; index += 1) {
		appendMarkdownDiffChunk(chunks, type, lines[index] ?? '');
	}
}

function createMarkdownPatchHunkDraft(
	previousEqualLines: string[],
	contextLineCount: number,
): MarkdownPatchHunkDraft {
	return {
		lines: previousEqualLines
			.slice(-contextLineCount)
			.map((line) => ({ type: 'context' as const, text: line })),
		nextLines: [],
		addedLineCount: 0,
		removedLineCount: 0,
	};
}

function applyMarkdownChunkToHunkDraft(chunk: MarkdownDiffChunk, draft: MarkdownPatchHunkDraft) {
	if (chunk.type === 'remove') {
		for (const line of chunk.lines) {
			draft.lines.push({ type: 'remove', text: line });
		}
		draft.removedLineCount += chunk.lines.length;
		return;
	}

	for (const line of chunk.lines) {
		draft.lines.push({ type: 'add', text: line });
		draft.nextLines.push(line);
	}
	draft.addedLineCount += chunk.lines.length;
}

function appendMarkdownContextLines(
	lines: MarkdownPatchDiffLine[],
	trailingEqualLines: string[],
	contextLineCount: number,
) {
	for (const line of trailingEqualLines.slice(0, contextLineCount)) {
		lines.push({ type: 'context', text: line });
	}
}

function consumeEqualMarkdownChunk(
	chunk: MarkdownDiffChunk,
	baseCursor: number,
	nextCursor: number,
) {
	return {
		baseCursor: baseCursor + chunk.lines.length,
		nextCursor: nextCursor + chunk.lines.length,
		previousEqualLines: chunk.lines,
	};
}

function readMarkdownPatchHunk(
	chunks: MarkdownDiffChunk[],
	startChunkIndex: number,
	baseCursor: number,
	nextCursor: number,
	previousEqualLines: string[],
	contextLineCount: number,
	hunkCount: number,
): MarkdownPatchHunkReadResult {
	const baseStart = baseCursor;
	const draft = createMarkdownPatchHunkDraft(previousEqualLines, contextLineCount);
	let chunkIndex = startChunkIndex;

	while (chunkIndex < chunks.length && chunks[chunkIndex]?.type !== 'equal') {
		const currentChunk = chunks[chunkIndex];
		if (!currentChunk) {
			break;
		}

		applyMarkdownChunkToHunkDraft(currentChunk, draft);
		if (currentChunk.type === 'remove') {
			baseCursor += currentChunk.lines.length;
		} else {
			nextCursor += currentChunk.lines.length;
		}

		chunkIndex += 1;
	}

	const trailingEqualLines =
		chunks[chunkIndex]?.type === 'equal' ? (chunks[chunkIndex]?.lines ?? []) : [];
	appendMarkdownContextLines(draft.lines, trailingEqualLines, contextLineCount);

	return {
		baseCursor,
		chunkIndex,
		nextCursor,
		previousEqualLines: trailingEqualLines,
		hunk: {
			id: `hunk-${baseStart}-${baseCursor}-${nextCursor}-${hunkCount + 1}`,
			baseStart,
			baseEnd: baseCursor,
			addedLineCount: draft.addedLineCount,
			removedLineCount: draft.removedLineCount,
			nextLines: draft.nextLines,
			lines: draft.lines,
		},
	};
}
