import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { useAppStore } from '@/stores/store';
import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type { PrototypeOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useParams } from '@tanstack/react-router';
import { useMemo } from 'react';
import { OverlayExpandButton } from '../OverlayExpandButton';
import { PrototypeStudioEditor } from './PrototypeStudioEditor';
import { usePrototypePreview } from './prototype-preview-runtime';
import { getPrototypeStudioPath } from './prototype-utils';

type PrototypeElement = ExcalidrawElement & {
	customData: PrototypeOverlayCustomData;
};

interface PrototypeNoteProps {
	element: PrototypeElement;
	mode: 'preview' | 'shell' | 'live';
	isSelected: boolean;
	isActive: boolean;
	onChange?: (elementId: string, updates: Partial<PrototypeOverlayCustomData>) => void;
	onActivityChange?: (isActive: boolean) => void;
}

function getPreviewStatusLabel(status: 'idle' | 'compiling' | 'running' | 'ready' | 'error') {
	switch (status) {
		case 'compiling':
			return 'Compiling';
		case 'running':
			return 'Loading';
		case 'ready':
			return 'Ready';
		case 'error':
			return 'Needs attention';
		default:
			return 'Idle';
	}
}

export function PrototypeNote({ element, isSelected, mode, onChange }: PrototypeNoteProps) {
	const { id: canvasId } = useParams({ strict: false }) as { id: string };
	const openExpandedOverlay = useAppStore((s) => s.openExpandedOverlay);
	const prototype = useMemo(
		() => normalizePrototypeOverlay(element.customData),
		[element.customData],
	);
	const visibleFiles = Object.keys(prototype.files).filter(
		(path) => !prototype.files[path]?.hidden,
	);
	const studioPath = getPrototypeStudioPath(canvasId, element.id);
	const preview = usePrototypePreview(prototype);

	if (mode === 'shell') {
		return (
			<OverlaySurface
				element={element}
				isSelected
				className="flex h-full flex-col bg-[linear-gradient(135deg,#f8f6f0_0%,#ffffff_48%,#eef3ff_100%)]"
			>
				<PrototypeStudioEditor
					value={prototype}
					chromeless
					onChange={(nextValue) =>
						onChange?.(element.id, {
							title: nextValue.title,
							template: nextValue.template,
							files: nextValue.files,
							dependencies: nextValue.dependencies,
							preview: nextValue.preview,
							activeFile: nextValue.activeFile,
							showEditor: nextValue.showEditor,
							showPreview: nextValue.showPreview,
						})
					}
				/>
			</OverlaySurface>
		);
	}

	return (
		<OverlaySurface
			element={element}
			isSelected={isSelected}
			className="flex h-full flex-col bg-[#f7f7f4]"
		>
			<div className="flex h-full min-h-0 flex-col">
				<div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white/90 px-4 py-3">
					<div className="min-w-0">
						<div className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400">
							Prototype
						</div>
						<div className="truncate text-sm font-semibold text-stone-900">{prototype.title}</div>
					</div>
					<div className="flex items-center gap-2">
						<div
							className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
								preview.status === 'ready'
									? 'border-emerald-200 bg-emerald-50 text-emerald-700'
									: preview.status === 'error'
										? 'border-rose-200 bg-rose-50 text-rose-700'
										: 'border-stone-200 bg-stone-50 text-stone-600'
							}`}
						>
							{getPreviewStatusLabel(preview.status)}
						</div>
						{!isSelected ? (
							<a
								href={studioPath}
								className="inline-flex items-center rounded-full bg-stone-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
							>
								Studio
							</a>
						) : null}
					</div>
				</div>

				<div className="min-h-0 flex-1 bg-stone-50">
					{prototype.showPreview && preview.srcDoc ? (
						<iframe
							key={preview.srcDoc}
							title={`${prototype.title} preview`}
							srcDoc={preview.srcDoc}
							sandbox="allow-scripts"
							className="h-full w-full border-0 bg-white pointer-events-none"
						/>
					) : (
						<div className="flex h-full items-center justify-center px-6 text-center text-sm text-stone-500">
							{prototype.showPreview
								? 'Preview will appear here after the prototype compiles.'
								: 'Canvas preview is hidden for this prototype.'}
						</div>
					)}
				</div>

				<div className="border-t border-stone-200 bg-white/88 px-4 py-3">
					<div className="flex items-center justify-between gap-3">
						<div className="text-xs text-stone-500">
							{visibleFiles.length} file{visibleFiles.length === 1 ? '' : 's'}
						</div>
						<div className="flex flex-wrap justify-end gap-2">
							{visibleFiles.slice(0, 3).map((path) => (
								<div
									key={path}
									className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500"
								>
									{path.replace(/^\//, '')}
								</div>
							))}
						</div>
					</div>
					{preview.diagnostics.length > 0 && (
						<div className="mt-3 rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
							{preview.diagnostics[0]?.message}
						</div>
					)}
				</div>
			</div>

			{isSelected ? <OverlayExpandButton onClick={() => openExpandedOverlay(element.id)} /> : null}
		</OverlaySurface>
	);
}
