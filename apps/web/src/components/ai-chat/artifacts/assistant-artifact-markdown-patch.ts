import type {
	AssistantArtifact,
	AssistantMarkdownPatchArtifact,
	MarkdownOverlayCustomData,
} from '@ai-canvas/shared/types';
import { normalizeLineEndings } from './assistant-artifact-text';

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

		const trailingEqualLines =
			chunks[chunkIndex]?.type === 'equal' ? (chunks[chunkIndex]?.lines ?? []) : [];
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
