import { OverlaySurface } from '@/components/overlays/overlay-surface';
import type { NewLexOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useMemo } from 'react';

interface LexicalPreviewCardProps {
	element: ExcalidrawElement & { customData: NewLexOverlayCustomData };
	isSelected: boolean;
}

interface LexicalNode {
	type?: string;
	text?: string;
	children?: LexicalNode[];
}

interface LexicalRoot {
	root?: LexicalNode;
}

function extractTextFromLexicalState(lexicalState: string): string {
	try {
		const parsed = JSON.parse(lexicalState) as LexicalRoot;
		if (!parsed.root) return '';
		return extractTextFromNode(parsed.root);
	} catch {
		return '';
	}
}

function extractTextFromNode(node: LexicalNode): string {
	if (node.text) {
		return node.text;
	}
	if (node.children) {
		return node.children.map(extractTextFromNode).join(' ');
	}
	return '';
}

function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	const truncated = text.slice(0, maxLength);
	const lastSpace = truncated.lastIndexOf(' ');
	if (lastSpace > maxLength * 0.7) {
		return `${truncated.slice(0, lastSpace)}...`;
	}
	return `${truncated}...`;
}

export function LexicalPreviewCard({ element, isSelected }: LexicalPreviewCardProps) {
	const { title, lexicalState, comments, resourceSnapshot } = element.customData;
	const displayTitle = resourceSnapshot?.title ?? title;
	const displayBadge = resourceSnapshot?.display?.badge;
	const displaySummary = resourceSnapshot?.display?.summary;
	const contentSnippet = useMemo(() => {
		const text = extractTextFromLexicalState(lexicalState);
		return truncateText(text.trim(), 200);
	}, [lexicalState]);
	const previewText = displaySummary ?? contentSnippet;

	const commentCount = comments?.length ?? 0;

	return (
		<OverlaySurface element={element} isSelected={isSelected} className="flex h-full flex-col">
			<div className="flex h-full flex-col bg-white">
				{/* Header */}
				<div className="flex min-h-14 items-center justify-between gap-3 border-b border-stone-200/80 px-4 py-3">
					<div className="min-w-0 flex-1">
						{displayTitle ? (
							<div className="truncate font-semibold text-stone-900">{displayTitle}</div>
						) : (
							<div className="truncate text-sm italic text-stone-400">Untitled note</div>
						)}
					</div>
					<div className="flex items-center gap-2">
						{displayBadge ? (
							<div className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
								{displayBadge}
							</div>
						) : null}
						<div className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
							Rich text
						</div>
					</div>
				</div>

				{/* Content preview */}
				<div className="min-h-0 flex-1 px-4 py-4">
					{previewText ? (
						<p className="line-clamp-6 text-sm leading-relaxed text-stone-600">{previewText}</p>
					) : (
						<div className="flex h-full items-center justify-center">
							<p className="text-sm italic text-stone-400">Empty note</p>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between gap-3 border-t border-stone-200/80 px-4 py-3">
					<div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
						{commentCount > 0 && (
							<span>
								{commentCount} comment{commentCount !== 1 ? 's' : ''}
							</span>
						)}
					</div>
					<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
						Double-click to open
					</div>
				</div>
			</div>
		</OverlaySurface>
	);
}
