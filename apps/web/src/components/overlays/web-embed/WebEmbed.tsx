import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { useMountEffect } from '@/hooks/useMountEffect';
import { enhanceUrl, isKnownEmbeddable } from '@/lib/web-embed-utils';
import type { WebEmbedOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useWebEmbedState } from './useWebEmbedState';


type WebEmbedElement = ExcalidrawElement & {
	customData: WebEmbedOverlayCustomData;
};

interface WebEmbedProps {
	element: WebEmbedElement;
	mode: 'preview' | 'shell' | 'live';
	isSelected: boolean;
	isActive: boolean;
	onChange: (elementId: string, url: string) => void;
	onActivityChange?: (isActive: boolean) => void;
}

export function WebEmbed(props: WebEmbedProps) {
	const { element, isSelected, onChange, onActivityChange } = props;
	const state = useWebEmbedState({
		element,
		onChange,
		onActivityChange,
	});

	const {
		urlInput,
		isEditing,
		viewMode,
		isLoading,
		viewport,
		pipPosition,
		pipDimensions,
		pipDragCleanupRef,
		onActivityChangeRef,
		lastReportedEditingRef,
		setUrlInput,
		setIsLoading,
		setViewMode,
		setPipPosition,
		handleStopEditing,
		handleSubmitUrl,
		handleToggleEdit,
		handleTogglePip,
		handleToggleExpand,
		clearPipDragListeners,
	} = state;

	// Cleanup on unmount: report inactive and clear drag listeners
	useMountEffect(() => {
		return () => {
			clearPipDragListeners();
			if (lastReportedEditingRef.current) {
				onActivityChangeRef.current?.(false);
				lastReportedEditingRef.current = false;
			}
		};
	});

	// Handle exiting edit mode when deselected in inline mode
	// Using derived state check during render instead of useEffect
	if (!isSelected && viewMode === 'inline' && isEditing) {
		handleStopEditing();
	}

	const enhanced = useMemo(
		() => enhanceUrl(urlInput || element.customData.url),
		[element.customData.url, urlInput],
	);
	const previewUrl = enhanced.embedUrl || enhanced.url;
	const canRenderIframe = Boolean(previewUrl && !enhanced.warning);
	const embeddable = previewUrl ? isKnownEmbeddable(previewUrl) : false;

	const handlePipMouseDown = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			const start = { x: event.clientX, y: event.clientY };
			const origin = pipPosition;

			clearPipDragListeners();

			const handleMove = (moveEvent: MouseEvent) => {
				setPipPosition({
					x: origin.x + (moveEvent.clientX - start.x),
					y: origin.y + (moveEvent.clientY - start.y),
				});
			};

			const handleUp = () => {
				clearPipDragListeners();
			};

			pipDragCleanupRef.current = () => {
				window.removeEventListener('mousemove', handleMove);
				window.removeEventListener('mouseup', handleUp);
			};

			window.addEventListener('mousemove', handleMove);
			window.addEventListener('mouseup', handleUp);
		},
		[clearPipDragListeners, pipDragCleanupRef, pipPosition, setPipPosition],
	);

	const frame = (
		<OverlaySurface element={element} isSelected={isSelected} className="flex h-full flex-col">
			<div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-100/80 px-3 py-2">
				<input
					value={urlInput}
					onChange={(event) => setUrlInput(event.target.value)}
					className="min-w-48 flex-1 rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none"
					placeholder="Paste a URL"
					readOnly={!isSelected && !isEditing}
				/>
				{(isSelected || isEditing) && (
					<button
						type="button"
						className="rounded-full border border-stone-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
						onClick={handleSubmitUrl}
					>
						Go
					</button>
				)}
				{element.customData.url && (
					<>
						<button
							type="button"
							className="rounded-full border border-stone-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
							onClick={handleToggleEdit}
						>
							{isEditing ? 'View' : 'Edit'}
						</button>
						<button
							type="button"
							className="rounded-full border border-stone-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
							onClick={handleTogglePip}
						>
							PiP
						</button>
						<button
							type="button"
							className="rounded-full border border-stone-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
							onClick={handleToggleExpand}
						>
							Expand
						</button>
						{previewUrl ? (
							<a
								href={enhanced.url}
								target="_blank"
								rel="noreferrer"
								className="rounded-full border border-stone-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
							>
								Open
							</a>
						) : null}
					</>
				)}
			</div>

			<div className="relative min-h-0 flex-1 bg-stone-950/5">
				{enhanced.warning ? (
					<div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
						<p className="max-w-md text-sm text-stone-600">{enhanced.warning}</p>
						{enhanced.url && (
							<a
								href={enhanced.url}
								target="_blank"
								rel="noreferrer"
								className="rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
							>
								Open in new tab
							</a>
						)}
					</div>
				) : canRenderIframe ? (
					<div className="relative h-full w-full">
						{!embeddable && (
							<div className="absolute inset-x-3 top-3 z-10 rounded-2xl bg-amber-100 px-3 py-2 text-xs text-amber-800 shadow">
								This site may block embedding. If it fails, open it in a new tab.
							</div>
						)}
						{isLoading ? (
							<div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
								Loading embed
							</div>
						) : null}
						<iframe
							title={`Web embed ${element.id}`}
							src={previewUrl}
							className="h-full w-full border-0"
							sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
							referrerPolicy="strict-origin-when-cross-origin"
							onLoad={() => setIsLoading(false)}
						/>
					</div>
				) : (
					<div className="flex h-full items-center justify-center p-6 text-center text-sm text-stone-500">
						Paste a URL to embed a page, video, document, or prototype.
					</div>
				)}
			</div>
		</OverlaySurface>
	);

	if (viewMode === 'pip' && typeof document !== 'undefined') {
		return createPortal(
			<div
				className="fixed z-[1200]"
				style={{
					left: pipPosition.x,
					top: pipPosition.y,
					width: pipDimensions.width,
					height: pipDimensions.height,
				}}
			>
				<div className="h-full cursor-move" onMouseDown={handlePipMouseDown}>
					{frame}
				</div>
			</div>,
			document.body,
		);
	}

	if (viewMode === 'expanded' && typeof document !== 'undefined') {
		return createPortal(
			<div className="fixed inset-0 z-[1250] bg-stone-950/30 p-[5vh]">
				<div className="h-full w-full">{frame}</div>
			</div>,
			document.body,
		);
	}

	return frame;
}
