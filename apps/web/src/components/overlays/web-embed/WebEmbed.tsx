import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { enhanceUrl, isKnownEmbeddable } from '@/lib/web-embed-utils';
import type { WebEmbedOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
	type WebEmbedViewMode,
	clampPipPosition,
	getDefaultPipPosition,
	getPipDimensions,
} from './web-embed-view';

type WebEmbedElement = ExcalidrawElement & {
	customData: WebEmbedOverlayCustomData;
};

interface WebEmbedProps {
	element: WebEmbedElement;
	isSelected: boolean;
	onChange: (elementId: string, url: string) => void;
	onEditingChange?: (isEditing: boolean) => void;
}

export function WebEmbed({ element, isSelected, onChange, onEditingChange }: WebEmbedProps) {
	const [urlInput, setUrlInput] = useState(element.customData.url);
	const [isEditing, setIsEditing] = useState(!element.customData.url);
	const [viewMode, setViewMode] = useState<WebEmbedViewMode>('inline');
	const [isLoading, setIsLoading] = useState(false);
	const [viewport, setViewport] = useState({
		width: typeof window === 'undefined' ? 1440 : window.innerWidth,
		height: typeof window === 'undefined' ? 900 : window.innerHeight,
	});
	const [pipPosition, setPipPosition] = useState(() => getDefaultPipPosition(viewport));
	const onEditingChangeRef = useRef(onEditingChange);
	const lastReportedEditingRef = useRef<boolean | null>(null);
	const pipDragCleanupRef = useRef<(() => void) | null>(null);

	const clearPipDragListeners = useCallback(() => {
		pipDragCleanupRef.current?.();
		pipDragCleanupRef.current = null;
	}, []);

	useEffect(() => {
		onEditingChangeRef.current = onEditingChange;
	}, [onEditingChange]);

	useEffect(() => {
		setUrlInput(element.customData.url);
		if (!element.customData.url) setIsEditing(true);
	}, [element.customData.url]);

	useEffect(() => {
		if (!isSelected && viewMode === 'inline') {
			setIsEditing(false);
		}
	}, [isSelected, viewMode]);

	const isActivelyEditing = isEditing || viewMode !== 'inline';

	useEffect(() => {
		if (lastReportedEditingRef.current === isActivelyEditing) return;
		lastReportedEditingRef.current = isActivelyEditing;
		onEditingChangeRef.current?.(isActivelyEditing);
	}, [isActivelyEditing]);

	useEffect(
		() => () => {
			clearPipDragListeners();
			if (lastReportedEditingRef.current) {
				onEditingChangeRef.current?.(false);
				lastReportedEditingRef.current = false;
			}
		},
		[clearPipDragListeners],
	);

	useEffect(() => {
		if (viewMode !== 'pip') {
			clearPipDragListeners();
		}
	}, [clearPipDragListeners, viewMode]);

	useEffect(() => {
		const onResize = () => {
			const nextViewport = { width: window.innerWidth, height: window.innerHeight };
			setViewport(nextViewport);
			setPipPosition((current) => clampPipPosition(current, nextViewport));
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	const enhanced = useMemo(
		() => enhanceUrl(urlInput || element.customData.url),
		[element.customData.url, urlInput],
	);
	const previewUrl = enhanced.embedUrl || enhanced.url;
	const canRenderIframe = Boolean(previewUrl && !enhanced.warning);
	const embeddable = previewUrl ? isKnownEmbeddable(previewUrl) : false;
	const pipDimensions = getPipDimensions(viewport.width);

	const handlePipMouseDown = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			const start = { x: event.clientX, y: event.clientY };
			const origin = pipPosition;

			clearPipDragListeners();

			const handleMove = (moveEvent: MouseEvent) => {
				setPipPosition(
					clampPipPosition(
						{
							x: origin.x + (moveEvent.clientX - start.x),
							y: origin.y + (moveEvent.clientY - start.y),
						},
						viewport,
					),
				);
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
		[clearPipDragListeners, pipPosition, viewport],
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
						onClick={() => {
							onChange(element.id, urlInput.trim());
							setIsEditing(false);
							setIsLoading(true);
						}}
					>
						Go
					</button>
				)}
				{element.customData.url && (
					<>
						<button
							type="button"
							className="rounded-full border border-stone-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
							onClick={() => setIsEditing((current) => !current)}
						>
							{isEditing ? 'View' : 'Edit'}
						</button>
						<button
							type="button"
							className="rounded-full border border-stone-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
							onClick={() => setViewMode((current) => (current === 'pip' ? 'inline' : 'pip'))}
						>
							PiP
						</button>
						<button
							type="button"
							className="rounded-full border border-stone-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
							onClick={() =>
								setViewMode((current) => (current === 'expanded' ? 'inline' : 'expanded'))
							}
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
