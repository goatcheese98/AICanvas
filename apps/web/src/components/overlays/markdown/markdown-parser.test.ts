import { describe, expect, it } from 'vitest';
import {
	insertMarkdownBlock,
	moveMarkdownBlock,
	parseMarkdownBlocks,
	reconstructMarkdown,
	removeMarkdownBlock,
	updateMarkdownBlock,
} from './markdown-parser';

describe('markdown-parser', () => {
	it('parses markdown into semantic blocks', () => {
		const blocks = parseMarkdownBlocks(
			'# Title\n\n- one\n- two\n\n| A | B |\n| - | - |\n| 1 | 2 |',
		);

		expect(blocks.map((block) => block.type)).toEqual(['heading', 'empty', 'list', 'table']);
	});

	it('reconstructs markdown without losing order', () => {
		const source = 'Paragraph\n\n```ts\nconst x = 1;\n```';
		expect(reconstructMarkdown(parseMarkdownBlocks(source))).toBe(source);
	});

	it('reindexes blocks after editing content', () => {
		const blocks = parseMarkdownBlocks('# Title\n\nParagraph');
		const updated = updateMarkdownBlock(blocks, blocks[0]!.id, '# Title\nSubtitle');

		expect(updated[1]?.startLine).toBe(2);
		expect(reconstructMarkdown(updated)).toBe('# Title\nSubtitle\n\nParagraph');
	});

	it('removes and reorders blocks without losing markdown', () => {
		const source = '# Title\n\nParagraph\n\n- item';
		const blocks = parseMarkdownBlocks(source);
		const removed = removeMarkdownBlock(blocks, blocks[1]!.id);
		expect(reconstructMarkdown(removed)).toBe('# Title\nParagraph\n\n- item');

		const moved = moveMarkdownBlock(removed, removed[3]!.id, removed[0]!.id);
		expect(reconstructMarkdown(moved)).toBe('- item\n# Title\nParagraph\n');
		expect(moved[1]?.startLine).toBe(1);
	});

	it('inserts a new block before or after an existing block', () => {
		const source = '# Title\n\nParagraph';
		const blocks = parseMarkdownBlocks(source);
		const insertedAfter = insertMarkdownBlock(blocks, blocks[0]!.id, 'after', {
			type: 'empty',
			rawContent: '',
		});

		expect(insertedAfter.insertedBlockId).toBeTruthy();
		expect(reconstructMarkdown(insertedAfter.blocks)).toBe('# Title\n\n\nParagraph');

		const insertedBefore = insertMarkdownBlock(blocks, blocks[2]!.id, 'before', {
			type: 'paragraph',
			rawContent: 'Inserted',
		});

		expect(reconstructMarkdown(insertedBefore.blocks)).toBe('# Title\n\nInserted\nParagraph');
	});
});
