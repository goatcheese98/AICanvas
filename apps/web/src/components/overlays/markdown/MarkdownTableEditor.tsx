import { useEffect, useMemo, useState } from 'react';

interface TableCell {
	content: string;
	isHeader: boolean;
}

interface TableRow {
	cells: TableCell[];
}

interface MarkdownTableEditorProps {
	markdown: string;
	onChange: (nextMarkdown: string) => void;
}

const TABLE_ACTION_BUTTON =
	'inline-flex h-8 items-center justify-center rounded-[8px] border border-stone-300 bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700 transition-colors hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]';

function parseMarkdownTable(markdown: string): TableRow[] {
	const lines = markdown
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	if (lines.length < 2) return [];

	const headerCells = lines[0]
		.split('|')
		.map((cell) => cell.trim())
		.filter(Boolean);

	const rows: TableRow[] = [
		{ cells: headerCells.map((content) => ({ content, isHeader: true })) },
	];

	for (let index = 2; index < lines.length; index += 1) {
		const dataCells = lines[index]
			.split('|')
			.map((cell) => cell.trim())
			.filter((cell, cellIndex, all) => !(cell === '' && (cellIndex === 0 || cellIndex === all.length - 1)));

		rows.push({
			cells: Array.from({ length: rows[0]?.cells.length ?? dataCells.length }, (_, cellIndex) => ({
				content: dataCells[cellIndex] ?? '',
				isHeader: false,
			})),
		});
	}

	return rows;
}

function serializeMarkdownTable(rows: TableRow[]): string {
	if (rows.length === 0) return '';

	const columnCount = rows[0]?.cells.length ?? 0;
	const widths = Array.from({ length: columnCount }, (_, columnIndex) =>
		Math.max(
			3,
			...rows.map((row) => (row.cells[columnIndex]?.content ?? '').length),
		),
	);

	const formatRow = (row: TableRow) =>
		`| ${row.cells.map((cell, index) => cell.content.padEnd(widths[index] ?? 3, ' ')).join(' | ')} |`;

	const header = formatRow(rows[0]);
	const separator = `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`;
	const data = rows.slice(1).map(formatRow);

	return [header, separator, ...data].join('\n');
}

export function MarkdownTableEditor({ markdown, onChange }: MarkdownTableEditorProps) {
	const [rows, setRows] = useState<TableRow[]>(() => parseMarkdownTable(markdown));
	const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
	const [draftValue, setDraftValue] = useState('');

	useEffect(() => {
		setRows(parseMarkdownTable(markdown));
	}, [markdown]);

	const columnCount = useMemo(() => rows[0]?.cells.length ?? 0, [rows]);

	if (rows.length === 0) {
		return <div className="p-4 text-sm text-stone-500">Invalid markdown table.</div>;
	}

	const commitRows = (nextRows: TableRow[]) => {
		setRows(nextRows);
		onChange(serializeMarkdownTable(nextRows));
	};

	const addColumn = () => {
		commitRows(
			rows.map((row, index) => ({
				cells: [...row.cells, { content: '', isHeader: index === 0 }],
			})),
		);
	};

	const addRow = () => {
		commitRows([
			...rows,
			{
				cells: Array.from({ length: columnCount }, () => ({ content: '', isHeader: false })),
			},
		]);
	};

	return (
		<div className="rounded-[10px] border border-indigo-200 bg-indigo-50/70 p-4">
			<div className="mb-3 flex items-center justify-end gap-2">
				<button
					type="button"
					onClick={addColumn}
					className={TABLE_ACTION_BUTTON}
				>
					Add column
				</button>
				<button
					type="button"
					onClick={addRow}
					className={TABLE_ACTION_BUTTON}
				>
					Add row
				</button>
			</div>

			<div className="overflow-x-auto">
				<table className="min-w-full border-collapse overflow-hidden rounded-[10px] border border-stone-200 bg-white">
					<tbody>
						{rows.map((row, rowIndex) => (
							<tr key={rowIndex}>
								{row.cells.map((cell, colIndex) => {
									const Tag = cell.isHeader ? 'th' : 'td';
									const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
									return (
										<Tag
											key={`${rowIndex}-${colIndex}`}
											className={`border border-stone-200 px-3 py-2 text-left align-top ${
												cell.isHeader ? 'bg-stone-100/80 font-semibold' : ''
											}`}
										>
											{isEditing ? (
												<input
													autoFocus
													value={draftValue}
													onChange={(event) => setDraftValue(event.target.value)}
													onBlur={() => {
														const nextRows = rows.map((candidateRow, candidateRowIndex) => ({
															cells: candidateRow.cells.map((candidateCell, candidateCellIndex) =>
																candidateRowIndex === rowIndex && candidateCellIndex === colIndex
																	? { ...candidateCell, content: draftValue }
																	: candidateCell,
															),
														}));
														commitRows(nextRows);
														setEditingCell(null);
														setDraftValue('');
													}}
													onKeyDown={(event) => {
														if (event.key === 'Enter') {
															(event.currentTarget as HTMLInputElement).blur();
														}
														if (event.key === 'Escape') {
															setEditingCell(null);
															setDraftValue('');
														}
													}}
													className="w-full min-w-20 rounded-[6px] border-0 bg-transparent outline-none"
												/>
											) : (
												<button
													type="button"
													onClick={() => {
														setEditingCell({ row: rowIndex, col: colIndex });
														setDraftValue(cell.content);
													}}
													className="min-h-6 w-full text-left"
												>
													{cell.content || <span className="text-stone-300">Empty</span>}
												</button>
											)}
										</Tag>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
