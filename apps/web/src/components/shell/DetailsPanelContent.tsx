import type { TypedOverlayCanvasElement } from '@/components/canvas/overlay-definition-types';
import { collectOverlayElements } from '@/components/canvas/overlay-registry';
import { useAppStore } from '@/stores/store';
import type { OverlayType } from '@ai-canvas/shared/types';
import { useMemo } from 'react';
import { getOverlayTypeLabel } from './resource-type-utils';

interface DetailsPanelContentProps {
	element?: TypedOverlayCanvasElement | null;
	onOpenFocusedView?: (elementId: string) => void;
	onDeleteElement?: (elementId: string) => void;
}

/**
 * DetailsPanelContent - Shows resource metadata and actions in the right panel.
 *
 * Features:
 * - Displays resource type icon, title, and metadata
 * - Shows created/updated info when available
 * - Provides actions: Open (focused view), Ask AI, Delete
 * - Adapts content based on resource type
 */
export function DetailsPanelContent({
	element,
	onOpenFocusedView,
	onDeleteElement,
}: DetailsPanelContentProps) {
	const elements = useAppStore((s) => s.elements);
	const selectedElementIds = useAppStore((s) => s.appState.selectedElementIds ?? {});

	const resolvedElement = useMemo(() => {
		if (element !== undefined) {
			return element;
		}

		const selectedIds = Object.keys(selectedElementIds);
		if (selectedIds.length !== 1) {
			return null;
		}

		const selectedElement = elements.find((candidate) => candidate.id === selectedIds[0]);
		if (!selectedElement) {
			return null;
		}

		return collectOverlayElements([selectedElement])[0] ?? null;
	}, [element, elements, selectedElementIds]);

	if (!resolvedElement) {
		return (
			<div className="p-4 text-sm text-stone-500">
				<p>Select an item to view details</p>
			</div>
		);
	}

	const type = resolvedElement.customData.type as OverlayType;
	const title = extractTitle(resolvedElement);
	const metadata = extractMetadata(resolvedElement);

	return (
		<div className="flex h-full flex-col">
			{/* Header with type icon and title */}
			<div className="border-b border-stone-100 p-4">
				<div className="flex items-start gap-3">
					<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
						<TypeIcon type={type} />
					</div>
					<div className="min-w-0 flex-1">
						<h3 className="truncate font-semibold text-stone-900" title={title}>
							{title}
						</h3>
						<p className="text-xs text-stone-500">{getOverlayTypeLabel(type)}</p>
					</div>
				</div>
			</div>

			{/* Metadata section */}
			<div className="flex-1 space-y-4 overflow-y-auto p-4">
				{metadata.length > 0 && (
					<div className="space-y-2">
						<h4 className="text-xs font-medium uppercase tracking-wide text-stone-400">Info</h4>
						<div className="space-y-1.5 rounded-lg bg-stone-50 p-3">
							{metadata.map((item) => (
								<div key={item.label} className="flex justify-between text-sm">
									<span className="text-stone-500">{item.label}</span>
									<span className="text-stone-700">{item.value}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Element properties */}
				<div className="space-y-2">
					<h4 className="text-xs font-medium uppercase tracking-wide text-stone-400">Properties</h4>
					<div className="space-y-1.5 rounded-lg bg-stone-50 p-3">
						<div className="flex justify-between text-sm">
							<span className="text-stone-500">Size</span>
							<span className="text-stone-700">
								{Math.round(resolvedElement.width)} × {Math.round(resolvedElement.height)}
							</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-stone-500">Position</span>
							<span className="text-stone-700">
								{Math.round(resolvedElement.x)}, {Math.round(resolvedElement.y)}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Actions footer */}
			<div className="border-t border-stone-100 p-4">
				<div className="flex flex-col gap-2">
					<button
						type="button"
						onClick={() => onOpenFocusedView?.(resolvedElement.id)}
						className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4d55cc] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3d45b0]"
					>
						<ExpandIcon />
						Open
					</button>
					<div className="flex gap-2">
						<button
							type="button"
							className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
						>
							<SparklesIcon />
							Ask AI
						</button>
						<button
							type="button"
							onClick={() => onDeleteElement?.(resolvedElement.id)}
							className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
						>
							<TrashIcon />
							Delete
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * Extract title from element based on its type.
 */
function extractTitle(element: TypedOverlayCanvasElement): string {
	const customData = element.customData as { title?: string; type: string };

	switch (customData.type) {
		case 'kanban':
			return customData.title ?? 'Untitled Board';
		case 'newlex':
			return customData.title ?? 'Untitled Document';
		case 'markdown':
			return customData.title ?? 'Untitled Note';
		case 'web-embed':
			return 'Web Embed';
		case 'prototype':
			return customData.title ?? 'Untitled Prototype';
		default:
			return 'Untitled';
	}
}

interface MetadataItem {
	label: string;
	value: string;
}

/**
 * Extract metadata from element based on its type.
 */
function extractMetadata(element: TypedOverlayCanvasElement): MetadataItem[] {
	const customData = element.customData as Record<string, unknown>;
	const metadata: MetadataItem[] = [];

	switch (customData.type) {
		case 'kanban': {
			const kanbanData = customData as {
				columns?: { cards?: unknown[] }[];
				lastUpdated?: number;
				resourceSnapshot?: { display?: { badge?: string } };
			};
			const columnCount = kanbanData.columns?.length ?? 0;
			const cardCount =
				kanbanData.columns?.reduce(
					(sum, col) => sum + (Array.isArray(col.cards) ? col.cards.length : 0),
					0,
				) ?? 0;
			metadata.push(
				{ label: 'Columns', value: String(columnCount) },
				{ label: 'Cards', value: String(cardCount) },
			);
			if (kanbanData.lastUpdated) {
				metadata.push({
					label: 'Updated',
					value: formatDate(kanbanData.lastUpdated),
				});
			}
			if (kanbanData.resourceSnapshot?.display?.badge) {
				metadata.push({
					label: 'Snapshot',
					value: kanbanData.resourceSnapshot.display.badge,
				});
			}
			break;
		}
		case 'newlex': {
			const newlexData = customData as {
				comments?: unknown[];
				version?: number;
				resourceSnapshot?: { display?: { badge?: string } };
			};
			const commentCount = Array.isArray(newlexData.comments) ? newlexData.comments.length : 0;
			metadata.push({ label: 'Comments', value: String(commentCount) });
			if (newlexData.version && newlexData.version > 1) {
				metadata.push({ label: 'Version', value: String(newlexData.version) });
			}
			if (newlexData.resourceSnapshot?.display?.badge) {
				metadata.push({
					label: 'Snapshot',
					value: newlexData.resourceSnapshot.display.badge,
				});
			}
			break;
		}
		case 'markdown': {
			const mdData = customData as { content?: string; editorMode?: string };
			if (mdData.editorMode) {
				metadata.push({
					label: 'Mode',
					value: mdData.editorMode === 'hybrid' ? 'Hybrid' : 'Standard',
				});
			}
			if (typeof mdData.content === 'string') {
				const wordCount = mdData.content.trim().split(/\s+/).filter(Boolean).length;
				metadata.push({ label: 'Words', value: String(wordCount) });
			}
			break;
		}
		case 'web-embed': {
			const embedData = customData as { url?: string };
			if (embedData.url) {
				try {
					const url = new URL(embedData.url);
					metadata.push({ label: 'Domain', value: url.hostname });
				} catch {
					// Invalid URL, skip
				}
			}
			break;
		}
		case 'prototype': {
			const prototypeData = customData as {
				template?: string;
				files?: Record<string, unknown>;
				dependencies?: Record<string, string>;
				resourceSnapshot?: { display?: { badge?: string } };
			};
			if (prototypeData.template) {
				metadata.push({
					label: 'Template',
					value: prototypeData.template === 'react' ? 'React' : 'Vanilla JS',
				});
			}
			if (prototypeData.files) {
				const fileCount = Object.keys(prototypeData.files).length;
				metadata.push({ label: 'Files', value: String(fileCount) });
			}
			if (prototypeData.dependencies) {
				const depCount = Object.keys(prototypeData.dependencies).length;
				if (depCount > 0) {
					metadata.push({ label: 'Dependencies', value: String(depCount) });
				}
			}
			if (prototypeData.resourceSnapshot?.display?.badge) {
				metadata.push({
					label: 'Snapshot',
					value: prototypeData.resourceSnapshot.display.badge,
				});
			}
			break;
		}
	}

	return metadata;
}

function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return 'Just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString();
}

// Icons
function TypeIcon({ type }: { type: OverlayType }) {
	switch (type) {
		case 'kanban':
			return <KanbanIcon />;
		case 'newlex':
			return <DocumentIcon />;
		case 'markdown':
			return <NoteIcon />;
		case 'web-embed':
			return <GlobeIcon />;
		case 'prototype':
			return <CodeIcon />;
		default:
			return <FileIcon />;
	}
}

function KanbanIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<rect x="3" y="3" width="7" height="18" rx="1" />
			<rect x="14" y="3" width="7" height="12" rx="1" />
		</svg>
	);
}

function DocumentIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
		</svg>
	);
}

function NoteIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
		</svg>
	);
}

function GlobeIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<circle cx="12" cy="12" r="10" />
			<line x1="2" y1="12" x2="22" y2="12" />
			<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
		</svg>
	);
}

function FileIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
		</svg>
	);
}

function CodeIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<polyline points="16 18 22 12 16 6" />
			<polyline points="8 6 2 12 8 18" />
		</svg>
	);
}

function ExpandIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M8 3H5a2 2 0 0 0-2 2v3" />
			<path d="M21 8V5a2 2 0 0 0-2-2h-3" />
			<path d="M3 16v3a2 2 0 0 0 2 2h3" />
			<path d="M16 21h3a2 2 0 0 0 2-2v-3" />
		</svg>
	);
}

function SparklesIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
		</svg>
	);
}

function TrashIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M3 6h18" />
			<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
			<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
		</svg>
	);
}
