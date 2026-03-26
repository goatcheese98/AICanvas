import type { MarkdownNoteSettings } from '@ai-canvas/shared/types';
import { useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MarkdownTableEditor } from './MarkdownTableEditor';
import { handleImagePasteAsMarkdown } from './markdown-media';
import {
	type MarkdownBlock,
	insertMarkdownBlock,
	moveMarkdownBlock,
	parseMarkdownBlocks,
	reconstructMarkdown,
	removeMarkdownBlock,
	updateMarkdownBlock,
} from './markdown-parser';

interface MarkdownHybridEditorProps {
	content: string;
	images?: Record<string, string>;
	settings: MarkdownNoteSettings;
	onChange: (nextValue: string) => void;
	onImageAdd: (id: string, dataUrl: string) => void;
	onCheckboxToggle: (lineIndex: number) => void;
}

const HYBRID_TOOLBAR =
	'rounded-[8px] border border-stone-200 bg-white/95 text-stone-700 shadow-sm backdrop-blur';
const HYBRID_BUTTON =
	'inline-flex h-8 items-center justify-center rounded-[8px] border px-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors';
const HYBRID_BUTTON_IDLE =
	'border-stone-300 bg-white text-stone-700 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]';
const HYBRID_ICON_BUTTON =
	'inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-stone-500 transition-colors';
const HYBRID_INSERT_BUTTON =
	'absolute left-1/2 z-10 inline-flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-[999px] border border-stone-200 bg-white text-stone-500 opacity-0 shadow-sm transition group-hover:opacity-100 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]';

export function MarkdownHybridEditor({
	content,
	images,
	settings,
	onChange,
	onImageAdd,
	onCheckboxToggle,
}: MarkdownHybridEditorProps) {
	const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);
	const [localBlocks, setLocalBlocks] = useState<MarkdownBlock[]>(blocks);
	const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
	const [editingDraft, setEditingDraft] = useState('');
	const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
	const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
	const [dropTargetBlockId, setDropTargetBlockId] = useState<string | null>(null);
	const localBlocksRef = useRef(localBlocks);

	// Keep localBlocksRef in sync (justified ref sync for closures)
	localBlocksRef.current = localBlocks;

	// Derived state: sync blocks from external content using ref comparison
	// This replaces the useEffect external sync pattern
	const lastBlocksRef = useRef(blocks);
	const shouldSyncFromExternal = blocks !== lastBlocksRef.current;
	if (shouldSyncFromExternal) {
		const currentEditingBlock = editingBlockId
			? (lastBlocksRef.current.find((block) => block.id === editingBlockId) ?? null)
			: null;
		const nextEditingBlock = currentEditingBlock
			? (blocks.find((block) => block.startLine === currentEditingBlock.startLine) ?? null)
			: null;
		lastBlocksRef.current = blocks;
		localBlocksRef.current = blocks;
		setLocalBlocks(blocks);
		if (currentEditingBlock && nextEditingBlock && nextEditingBlock.id !== editingBlockId) {
			setEditingBlockId(nextEditingBlock.id);
		}
	}

	const selectedBlocks = useMemo(
		() => localBlocks.filter((block) => selectedBlockIds.has(block.id)),
		[localBlocks, selectedBlockIds],
	);
	const visibleBlocks = useMemo(
		() =>
			localBlocks.filter(
				(block) => settings.showEmptyLines || block.type !== 'empty' || editingBlockId === block.id,
			),
		[editingBlockId, localBlocks, settings.showEmptyLines],
	);

	const applyBlocksChange = (nextBlocks: MarkdownBlock[]) => {
		localBlocksRef.current = nextBlocks;
		setLocalBlocks(nextBlocks);
		onChange(reconstructMarkdown(nextBlocks));
	};

	const commitBlockChange = (blockId: string, nextContent: string) => {
		applyBlocksChange(updateMarkdownBlock(localBlocksRef.current, blockId, nextContent));
	};

	const beginEditingBlock = (block: MarkdownBlock) => {
		setSelectedBlockIds(new Set());
		setEditingBlockId(block.id);
		setEditingDraft(block.rawContent);
	};

	const finishEditingBlock = (blockId: string, nextContent: string) => {
		const existing = localBlocksRef.current.find((block) => block.id === blockId)?.rawContent ?? '';
		if (nextContent !== existing) {
			commitBlockChange(blockId, nextContent);
		}
		setEditingBlockId(null);
		setEditingDraft('');
	};

	const copyBlock = async (block: MarkdownBlock) => {
		await navigator.clipboard.writeText(block.rawContent);
	};

	const deleteBlock = (blockId: string) => {
		applyBlocksChange(removeMarkdownBlock(localBlocksRef.current, blockId));
		setEditingBlockId((current) => (current === blockId ? null : current));
		setEditingDraft((current) => (editingBlockId === blockId ? '' : current));
		setSelectedBlockIds((current) => {
			if (!current.has(blockId)) return current;
			const next = new Set(current);
			next.delete(blockId);
			return next;
		});
	};

	const handleDrop = (event: DragEvent<HTMLDivElement>, targetBlockId: string) => {
		event.preventDefault();
		setDropTargetBlockId(null);
		if (!draggedBlockId || draggedBlockId === targetBlockId) {
			setDraggedBlockId(null);
			return;
		}

		applyBlocksChange(moveMarkdownBlock(localBlocksRef.current, draggedBlockId, targetBlockId));
		setDraggedBlockId(null);
	};

	const insertEmptyBlock = (targetBlockId: string, position: 'before' | 'after') => {
		const result = insertMarkdownBlock(localBlocksRef.current, targetBlockId, position, {
			type: 'empty',
			rawContent: '',
		});
		applyBlocksChange(result.blocks);
		if (result.insertedBlockId) {
			setEditingBlockId(result.insertedBlockId);
			setEditingDraft('');
			setSelectedBlockIds(new Set());
		}
	};

	return (
		<div className="h-full overflow-auto px-3 py-3">
			<div className="space-y-1.5">
				{visibleBlocks.map((block) => {
					const isEditing = editingBlockId === block.id;
					const isSelected = selectedBlockIds.has(block.id);
					return (
						<div
							key={block.id}
							onDragOver={(event) => {
								event.preventDefault();
								if (draggedBlockId && draggedBlockId !== block.id) {
									setDropTargetBlockId(block.id);
								}
							}}
							onDragEnter={() => {
								if (draggedBlockId && draggedBlockId !== block.id) {
									setDropTargetBlockId(block.id);
								}
							}}
							onDragLeave={() => {
								setDropTargetBlockId((current) => (current === block.id ? null : current));
							}}
							onDrop={(event) => handleDrop(event, block.id)}
							className={`group relative rounded-[8px] border pr-10 transition ${
								isEditing
									? 'border-indigo-300 bg-white shadow-sm'
									: isSelected
										? 'border-indigo-300 bg-indigo-50/70'
										: draggedBlockId === block.id
											? 'border-stone-300 bg-stone-100/80'
											: 'border-transparent bg-transparent hover:border-stone-200 hover:bg-white/70'
							}`}
						>
							<button
								type="button"
								aria-label="Insert empty line above"
								title="Insert empty line above"
								onClick={() => insertEmptyBlock(block.id, 'before')}
								className={`${HYBRID_INSERT_BUTTON} -top-3`}
							>
								<svg
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path d="M12 5v14" />
									<path d="M5 12h14" />
								</svg>
							</button>
							{dropTargetBlockId === block.id ? (
								<div className="pointer-events-none absolute inset-x-2.5 -top-0.5 z-20">
									<div className="h-[3px] rounded-[999px] bg-[#4d55cc] shadow-[0_0_0_2px_rgba(255,255,255,0.9)]" />
								</div>
							) : null}
							<div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-0.5 rounded-[8px] border border-stone-200 bg-white/95 p-[2px] opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-within:opacity-100">
								<button
									type="button"
									title="Copy block"
									aria-label="Copy block"
									onClick={() => void copyBlock(block)}
									className={`${HYBRID_ICON_BUTTON} hover:bg-[#f3f1ff] hover:text-[#4d55cc]`}
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<rect x="9" y="9" width="11" height="11" rx="2" />
										<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
									</svg>
								</button>
								<button
									type="button"
									title="Delete block"
									aria-label="Delete block"
									onClick={() => deleteBlock(block.id)}
									className={`${HYBRID_ICON_BUTTON} hover:bg-rose-50 hover:text-rose-600`}
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<path d="M3 6h18" />
										<path d="M8 6V4h8v2" />
										<path d="M19 6l-1 14H6L5 6" />
										<path d="M10 11v6" />
										<path d="M14 11v6" />
									</svg>
								</button>
								<button
									type="button"
									title="Drag block"
									aria-label="Drag block"
									draggable
									onDragStart={() => setDraggedBlockId(block.id)}
									onDragEnd={() => {
										setDraggedBlockId(null);
										setDropTargetBlockId(null);
									}}
									className={`${HYBRID_ICON_BUTTON} cursor-grab hover:bg-[#f3f1ff] hover:text-[#4d55cc] active:cursor-grabbing`}
								>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
										<circle cx="9" cy="6" r="1.5" />
										<circle cx="15" cy="6" r="1.5" />
										<circle cx="9" cy="12" r="1.5" />
										<circle cx="15" cy="12" r="1.5" />
										<circle cx="9" cy="18" r="1.5" />
										<circle cx="15" cy="18" r="1.5" />
									</svg>
								</button>
							</div>
							{isEditing ? (
								block.type === 'table' ? (
									<MarkdownTableEditor
										markdown={block.rawContent}
										onChange={(nextValue) => commitBlockChange(block.id, nextValue)}
									/>
								) : (
									<textarea
										value={editingDraft}
										onChange={(event) => setEditingDraft(event.target.value)}
										onBlur={() => finishEditingBlock(block.id, editingDraft)}
										onPaste={(event) => {
											void handleImagePasteAsMarkdown({
												event,
												value: editingDraft,
												onChange: setEditingDraft,
												onImageAdd,
											});
										}}
										onKeyDown={(event) => {
											if (event.key === 'Escape') {
												event.preventDefault();
												setEditingBlockId(null);
												setEditingDraft('');
											}
										}}
										className="min-h-16 w-full resize-none border-0 bg-transparent px-3 py-2 text-stone-900 outline-none"
										style={{
											fontFamily: settings.font,
											fontSize: `${settings.fontSize}px`,
											lineHeight: settings.lineHeight,
										}}
									/>
								)
							) : (
								<button
									type="button"
									onClick={(event) => {
										if (event.shiftKey) {
											setSelectedBlockIds((current) => {
												const next = new Set(current);
												if (next.has(block.id)) next.delete(block.id);
												else next.add(block.id);
												return next;
											});
											setEditingBlockId(null);
											return;
										}

										beginEditingBlock(block);
									}}
									className="block w-full text-left"
								>
									{block.type === 'empty' ? (
										<div className="px-3 py-1.5 text-[12px] italic text-stone-300">Empty line</div>
									) : (
										<MarkdownRenderer
											content={block.rawContent}
											images={images}
											settings={settings}
											onCheckboxToggle={(lineIndex) =>
												onCheckboxToggle(block.startLine + lineIndex)
											}
											className="px-3 py-2"
										/>
									)}
								</button>
							)}
							<button
								type="button"
								aria-label="Insert empty line below"
								title="Insert empty line below"
								onClick={() => insertEmptyBlock(block.id, 'after')}
								className={`${HYBRID_INSERT_BUTTON} -bottom-3`}
							>
								<svg
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path d="M12 5v14" />
									<path d="M5 12h14" />
								</svg>
							</button>
						</div>
					);
				})}
			</div>
			{selectedBlocks.length > 1 ? (
				<div className="pointer-events-none sticky bottom-4 z-20 mt-4 flex justify-center">
					<div
						className={`pointer-events-auto flex items-center gap-2 px-3 py-2 ${HYBRID_TOOLBAR}`}
					>
						<span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
							{selectedBlocks.length} selected
						</span>
						<button
							type="button"
							onClick={async () => {
								await navigator.clipboard.writeText(
									selectedBlocks.map((block) => block.rawContent).join('\n\n'),
								);
								setSelectedBlockIds(new Set());
							}}
							className={`${HYBRID_BUTTON} border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]`}
						>
							Copy combined
						</button>
						<button
							type="button"
							onClick={() => setSelectedBlockIds(new Set())}
							className={`${HYBRID_BUTTON} ${HYBRID_BUTTON_IDLE}`}
						>
							Cancel
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}
