export interface MarkdownBlock {
	id: string;
	type: 'heading' | 'paragraph' | 'code' | 'list' | 'table' | 'blockquote' | 'hr' | 'empty';
	rawContent: string;
	startLine: number;
	endLine: number;
	metadata?: {
		level?: number;
		language?: string;
		ordered?: boolean;
	};
}

function createBlockId(type: MarkdownBlock['type'], line: number) {
	return `block-${type}-${line}`;
}

function withReindexedLines(blocks: MarkdownBlock[]): MarkdownBlock[] {
	let nextStartLine = 0;

	return blocks.map((block, index) => {
		const lineCount = Math.max(block.rawContent.split('\n').length, 1);
		const startLine = nextStartLine;
		const endLine = startLine + lineCount - 1;
		nextStartLine = endLine + 1;

		return {
			...block,
			id: `${block.type}-${index}-${startLine}`,
			startLine,
			endLine,
		};
	});
}

function parseCodeBlock(lines: string[], startLine: number): MarkdownBlock {
	const language = lines[startLine]?.trim().slice(3).trim() || 'plaintext';
	let endLine = startLine + 1;
	while (endLine < lines.length && !lines[endLine]?.trim().startsWith('```')) {
		endLine += 1;
	}

	return {
		id: createBlockId('code', startLine),
		type: 'code',
		rawContent: lines.slice(startLine, Math.min(endLine + 1, lines.length)).join('\n'),
		startLine,
		endLine: Math.min(endLine, lines.length - 1),
		metadata: { language },
	};
}

function parseBlockquote(lines: string[], startLine: number): MarkdownBlock {
	let endLine = startLine;
	while (endLine + 1 < lines.length && lines[endLine + 1]?.trim().startsWith('>')) {
		endLine += 1;
	}

	return {
		id: createBlockId('blockquote', startLine),
		type: 'blockquote',
		rawContent: lines.slice(startLine, endLine + 1).join('\n'),
		startLine,
		endLine,
	};
}

function parseTable(lines: string[], startLine: number): MarkdownBlock {
	let endLine = startLine + 2;
	while (endLine < lines.length && lines[endLine]?.trim().startsWith('|')) {
		endLine += 1;
	}

	return {
		id: createBlockId('table', startLine),
		type: 'table',
		rawContent: lines.slice(startLine, endLine).join('\n'),
		startLine,
		endLine: endLine - 1,
	};
}

function parseList(lines: string[], startLine: number): MarkdownBlock {
	const firstLine = lines[startLine] ?? '';
	const isOrdered = /^\s*\d+\.\s/.test(firstLine);
	const baseIndent = firstLine.match(/^(\s*)/)?.[1].length ?? 0;
	let endLine = startLine;

	while (endLine + 1 < lines.length) {
		const nextLine = lines[endLine + 1] ?? '';
		const nextIndent = nextLine.match(/^(\s*)/)?.[1].length ?? 0;
		const isListItem = /^(\s*)[-*+]\s/.test(nextLine) || /^(\s*)\d+\.\s/.test(nextLine);
		const isEmpty = nextLine.trim() === '';
		const isIndented = nextIndent > baseIndent;

		if (!isListItem && !isEmpty && !isIndented) break;
		endLine += 1;

		if (isEmpty && endLine + 1 < lines.length && lines[endLine + 1]?.trim() === '') {
			break;
		}
	}

	return {
		id: createBlockId('list', startLine),
		type: 'list',
		rawContent: lines.slice(startLine, endLine + 1).join('\n'),
		startLine,
		endLine,
		metadata: { ordered: isOrdered },
	};
}

function parseParagraph(lines: string[], startLine: number): MarkdownBlock {
	let endLine = startLine;
	while (endLine + 1 < lines.length) {
		const nextLine = lines[endLine + 1] ?? '';
		if (nextLine.trim() === '') break;
		if (
			/^#{1,6}\s/.test(nextLine.trim()) ||
			nextLine.trim().startsWith('```') ||
			/^(\*\*\*+|---+|___+)\s*$/.test(nextLine.trim()) ||
			nextLine.trim().startsWith('>') ||
			/^(\s*)[-*+]\s/.test(nextLine) ||
			/^(\s*)\d+\.\s/.test(nextLine) ||
			nextLine.trim().startsWith('|')
		) {
			break;
		}

		endLine += 1;
	}

	return {
		id: createBlockId('paragraph', startLine),
		type: 'paragraph',
		rawContent: lines.slice(startLine, endLine + 1).join('\n'),
		startLine,
		endLine,
	};
}

export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
	const lines = content.split('\n');
	const blocks: MarkdownBlock[] = [];
	let currentLine = 0;

	while (currentLine < lines.length) {
		const line = lines[currentLine] ?? '';

		if (line.trim().startsWith('```')) {
			const block = parseCodeBlock(lines, currentLine);
			blocks.push(block);
			currentLine = block.endLine + 1;
			continue;
		}

		if (/^(\*\*\*+|---+|___+)\s*$/.test(line.trim())) {
			blocks.push({
				id: createBlockId('hr', currentLine),
				type: 'hr',
				rawContent: line,
				startLine: currentLine,
				endLine: currentLine,
			});
			currentLine += 1;
			continue;
		}

		if (/^#{1,6}\s/.test(line.trim())) {
			const level = line.trim().match(/^(#{1,6})\s/)?.[1].length ?? 1;
			blocks.push({
				id: createBlockId('heading', currentLine),
				type: 'heading',
				rawContent: line,
				startLine: currentLine,
				endLine: currentLine,
				metadata: { level },
			});
			currentLine += 1;
			continue;
		}

		if (line.trim().startsWith('>')) {
			const block = parseBlockquote(lines, currentLine);
			blocks.push(block);
			currentLine = block.endLine + 1;
			continue;
		}

		if (line.trim().startsWith('|') && currentLine + 1 < lines.length) {
			const nextLine = lines[currentLine + 1]?.trim() ?? '';
			if (/^\|[\s:-]+\|/.test(nextLine)) {
				const block = parseTable(lines, currentLine);
				blocks.push(block);
				currentLine = block.endLine + 1;
				continue;
			}
		}

		if (/^(\s*)[-*+]\s/.test(line) || /^(\s*)\d+\.\s/.test(line)) {
			const block = parseList(lines, currentLine);
			blocks.push(block);
			currentLine = block.endLine + 1;
			continue;
		}

		if (line.trim() === '') {
			blocks.push({
				id: createBlockId('empty', currentLine),
				type: 'empty',
				rawContent: line,
				startLine: currentLine,
				endLine: currentLine,
			});
			currentLine += 1;
			continue;
		}

		const block = parseParagraph(lines, currentLine);
		blocks.push(block);
		currentLine = block.endLine + 1;
	}

	return withReindexedLines(blocks);
}

export function reconstructMarkdown(blocks: MarkdownBlock[]): string {
	return blocks.map((block) => block.rawContent).join('\n');
}

export function updateMarkdownBlock(
	blocks: MarkdownBlock[],
	blockId: string,
	newContent: string,
): MarkdownBlock[] {
	return withReindexedLines(
		blocks.map((block) =>
			block.id === blockId
				? {
						...block,
						rawContent: newContent,
					}
				: block,
		),
	);
}

export function removeMarkdownBlock(blocks: MarkdownBlock[], blockId: string): MarkdownBlock[] {
	const nextBlocks = blocks.filter((block) => block.id !== blockId);
	return withReindexedLines(nextBlocks);
}

export function moveMarkdownBlock(
	blocks: MarkdownBlock[],
	draggedBlockId: string,
	targetBlockId: string,
): MarkdownBlock[] {
	const draggedIndex = blocks.findIndex((block) => block.id === draggedBlockId);
	const targetIndex = blocks.findIndex((block) => block.id === targetBlockId);

	if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return blocks;

	const nextBlocks = [...blocks];
	const [draggedBlock] = nextBlocks.splice(draggedIndex, 1);
	const insertionIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
	nextBlocks.splice(insertionIndex, 0, draggedBlock);

	return withReindexedLines(nextBlocks);
}
