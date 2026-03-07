import { describe, expect, it } from 'vitest';
import { parseMarkdownTable, serializeMarkdownTable } from './MarkdownTableEditor';

describe('MarkdownTableEditor helpers', () => {
	it('parses markdown tables into header and body rows', () => {
		const rows = parseMarkdownTable('| Name | Role |\n| --- | --- |\n| Rohan | PM |');

		expect(rows).toHaveLength(2);
		expect(rows[0]?.cells.map((cell) => cell.content)).toEqual(['Name', 'Role']);
		expect(rows[1]?.cells.map((cell) => cell.content)).toEqual(['Rohan', 'PM']);
		expect(rows[0]?.cells.every((cell) => cell.isHeader)).toBe(true);
	});

	it('serializes tables with stable markdown structure', () => {
		const rows = parseMarkdownTable('| Name | Role |\n| --- | --- |\n| Rohan | PM |');
		expect(serializeMarkdownTable(rows)).toBe('| Name  | Role |\n| ----- | ---- |\n| Rohan | PM   |');
	});

	it('normalizes ragged rows to the header column count', () => {
		const rows = parseMarkdownTable('| A | B | C |\n| --- | --- | --- |\n| 1 | 2 |');
		expect(rows[1]?.cells.map((cell) => cell.content)).toEqual(['1', '2', '']);
	});
});
