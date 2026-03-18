import { useMemo, useRef, useState } from 'react';

interface TableCell {
	id: string;
	content: string;
	isHeader: boolean;
}

interface TableRow {
	id: string;
	cells: TableCell[];
}

interface MarkdownTableEditorProps {
	markdown: string;
	onChange: (nextMarkdown: string) => void;
}

const TABLE_ACTION_BUTTON =
	'inline-flex h-8 items-center justify-center rounded-[8px] border border-stone-300 bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700 transition-colors hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]';
const TABLE_ICON_BUTTON =
	'inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-stone-400 transition-colors hover:bg-[#f3f1ff] hover:text-[#4d55cc]';

function createTableId(prefix: string, index: number) {
	return `${prefix}-${index}`;
}

export function parseMarkdownTable(markdown: string): TableRow[] {
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
		{
			id: createTableId('row', 0),
			cells: headerCells.map((content, index) => ({
				id: createTableId('cell-0', index),
				content,
				isHeader: true,
			})),
		},
	];

	for (let index = 2; index < lines.length; index += 1) {
		const dataCells = lines[index]
			.split('|')
			.map((cell) => cell.trim())
			.filter(
				(cell, cellIndex, all) =>
					!(cell === '' && (cellIndex === 0 || cellIndex === all.length - 1)),
			);

		rows.push({
			id: createTableId('row', rows.length),
			cells: Array.from({ length: rows[0]?.cells.length ?? dataCells.length }, (_, cellIndex) => ({
				id: createTableId(`cell-${rows.length}`, cellIndex),
				content: dataCells[cellIndex] ?? '',
				isHeader: false,
			})),
		});
	}

	return rows;
}

export function serializeMarkdownTable(rows: TableRow[]): string {
	if (rows.length === 0) return '';

	const columnCount = rows[0]?.cells.length ?? 0;
	const widths = Array.from({ length: columnCount }, (_, columnIndex) =>
		Math.max(3, ...rows.map((row) => (row.cells[columnIndex]?.content ?? '').length)),
	);

	const formatRow = (row: TableRow) =>
		`| ${row.cells.map((cell, index) => cell.content.padEnd(widths[index] ?? 3, ' ')).join(' | ')} |`;

	const header = formatRow(rows[0]);
	const separator = `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`;
	const data = rows.slice(1).map(formatRow);

	return [header, separator, ...data].join('\n');
}

function normalizeMarkdownTable(markdown: string): string {
	return serializeMarkdownTable(parseMarkdownTable(markdown));
}

function createEmptyCell(rowIndex: number, cellIndex: number, isHeader: boolean): TableCell {
	return {
		id: createTableId(`cell-${rowIndex}`, cellIndex),
		content: '',
		isHeader,
	};
}

export function MarkdownTableEditor({ markdown, onChange }: MarkdownTableEditorProps) {
	const lastCommittedMarkdownRef = useRef(normalizeMarkdownTable(markdown));

	// Derived state: parse markdown when it changes externally
	// Use a ref to track last committed value to avoid resetting when we emit changes
	const normalizedIncoming = normalizeMarkdownTable(markdown);
	const shouldSyncFromExternal = normalizedIncoming !== lastCommittedMarkdownRef.current;

	const [localRows, setLocalRows] = useState<TableRow[]>(() => parseMarkdownTable(markdown));

	// Sync from external markdown when it differs from our last committed state
	// This uses the "derived state" pattern instead of useEffect
	const rows = shouldSyncFromExternal ? parseMarkdownTable(markdown) : localRows;
	if (shouldSyncFromExternal) {
		// Update local state and ref to match external
		setLocalRows(rows);
		lastCommittedMarkdownRef.current = normalizedIncoming;
	}

	const serializedRows = useMemo(() => serializeMarkdownTable(rows), [rows]);

	const columnCount = useMemo(() => rows[0]?.cells.length ?? 0, [rows]);

	if (rows.length === 0) {
		return <div className="p-4 text-sm text-stone-500">Invalid markdown table.</div>;
	}

	const commitRows = (nextRows: TableRow[]) => {
		const nextMarkdown = serializeMarkdownTable(nextRows);
		lastCommittedMarkdownRef.current = nextMarkdown;
		setLocalRows(nextRows);
		onChange(nextMarkdown);
	};

	const addColumn = () => {
		commitRows(
			rows.map((row, rowIndex) => ({
				...row,
				cells: [...row.cells, createEmptyCell(rowIndex, row.cells.length, rowIndex === 0)],
			})),
		);
	};

	const addRow = () => {
		commitRows([
			...rows,
			{
				id: createTableId('row', rows.length),
				cells: Array.from({ length: columnCount }, (_, cellIndex) =>
					createEmptyCell(rows.length, cellIndex, false),
				),
			},
		]);
	};

	const updateCell = (rowIndex: number, colIndex: number, content: string) => {
		commitRows(
			rows.map((row, candidateRowIndex) =>
				candidateRowIndex === rowIndex
					? {
							...row,
							cells: row.cells.map((cell, candidateColIndex) =>
								candidateColIndex === colIndex ? { ...cell, content } : cell,
							),
						}
					: row,
			),
		);
	};

	const removeColumn = (columnIndex: number) => {
		if (columnCount <= 1) return;

		commitRows(
			rows.map((row) => ({
				...row,
				cells: row.cells.filter((_, candidateColIndex) => candidateColIndex !== columnIndex),
			})),
		);
	};

	const removeRow = (rowIndex: number) => {
		if (rowIndex === 0) return;
		commitRows(rows.filter((_, candidateRowIndex) => candidateRowIndex !== rowIndex));
	};

	return (
		<div className="rounded-[10px] border border-indigo-200 bg-indigo-50/70 p-4">
			<div className="mb-3 flex items-center justify-end gap-2">
				<button type="button" onClick={addColumn} className={TABLE_ACTION_BUTTON}>
					Add column
				</button>
				<button type="button" onClick={addRow} className={TABLE_ACTION_BUTTON}>
					Add row
				</button>
			</div>

			<div className="overflow-x-auto">
				<table className="min-w-full border-collapse overflow-hidden rounded-[10px] border border-stone-200 bg-white">
					<tbody>
						{rows.map((row, rowIndex) => (
							<tr key={row.id}>
								{row.cells.map((cell, colIndex) => {
									const Tag = cell.isHeader ? 'th' : 'td';
									return (
										<Tag
											key={cell.id}
											className={`border border-stone-200 px-3 py-2 text-left align-top ${
												cell.isHeader ? 'bg-stone-100/80 font-semibold' : ''
											}`}
										>
											<div className="flex items-start gap-2">
												<input
													value={cell.content}
													onChange={(event) => updateCell(rowIndex, colIndex, event.target.value)}
													className="w-full min-w-20 rounded-[6px] border-0 bg-transparent px-0 py-0 outline-none placeholder:text-stone-300"
													placeholder={cell.isHeader ? 'Header' : 'Empty'}
												/>
												{cell.isHeader ? (
													<button
														type="button"
														aria-label={`Remove column ${colIndex + 1}`}
														title="Remove column"
														onClick={() => removeColumn(colIndex)}
														disabled={columnCount <= 1}
														className={`${TABLE_ICON_BUTTON} ${columnCount <= 1 ? 'cursor-not-allowed opacity-30 hover:bg-transparent hover:text-stone-400' : ''}`}
													>
														<svg
															width="12"
															height="12"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															strokeWidth="2"
														>
															<path d="M18 6 6 18" />
															<path d="m6 6 12 12" />
														</svg>
													</button>
												) : null}
											</div>
										</Tag>
									);
								})}
								{rowIndex > 0 ? (
									<td className="w-10 border border-stone-200 bg-stone-50/60 px-2 py-2 align-top">
										<button
											type="button"
											aria-label={`Remove row ${rowIndex}`}
											title="Remove row"
											onClick={() => removeRow(rowIndex)}
											className={TABLE_ICON_BUTTON}
										>
											<svg
												width="12"
												height="12"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
											>
												<path d="M18 6 6 18" />
												<path d="m6 6 12 12" />
											</svg>
										</button>
									</td>
								) : (
									<th className="w-10 border border-stone-200 bg-stone-100/80 px-2 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-400">
										Row
									</th>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
