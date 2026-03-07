import { useEffect, useMemo, useState } from 'react';
import type { WebEmbedOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { enhanceUrl, isKnownEmbeddable } from '@/lib/web-embed-utils';

type WebEmbedElement = ExcalidrawElement & {
	customData: WebEmbedOverlayCustomData;
};

interface WebEmbedProps {
	element: WebEmbedElement;
	isSelected: boolean;
	onChange: (elementId: string, url: string) => void;
	onEditingChange?: (isEditing: boolean) => void;
}

export function WebEmbed({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: WebEmbedProps) {
	const [urlInput, setUrlInput] = useState(element.customData.url);
	const [isEditing, setIsEditing] = useState(!element.customData.url);

	useEffect(() => {
		setUrlInput(element.customData.url);
		if (!element.customData.url) setIsEditing(true);
	}, [element.customData.url]);

	useEffect(() => {
		onEditingChange?.(isEditing);
		return () => onEditingChange?.(false);
	}, [isEditing, onEditingChange]);

	const enhanced = useMemo(() => enhanceUrl(urlInput || element.customData.url), [element.customData.url, urlInput]);
	const previewUrl = enhanced.embedUrl || enhanced.url;
	const canRenderIframe = Boolean(previewUrl && !enhanced.warning);
	const embeddable = previewUrl ? isKnownEmbeddable(previewUrl) : false;

	return (
		<div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-stone-300 bg-white shadow-xl">
			<div className="flex items-center gap-2 border-b border-stone-200 bg-stone-100/80 px-3 py-2">
				<input
					value={urlInput}
					onChange={(event) => setUrlInput(event.target.value)}
					className="w-full rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none"
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
						}}
					>
						Go
					</button>
				)}
				{element.customData.url && (
					<button
						type="button"
						className="rounded-full border border-stone-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
						onClick={() => setIsEditing((current) => !current)}
					>
						{isEditing ? 'View' : 'Edit'}
					</button>
				)}
			</div>

			<div className="min-h-0 flex-1 bg-stone-950/5">
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
						<iframe
							title={`Web embed ${element.id}`}
							src={previewUrl}
							className="h-full w-full border-0"
							sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
							referrerPolicy="strict-origin-when-cross-origin"
						/>
					</div>
				) : (
					<div className="flex h-full items-center justify-center p-6 text-center text-sm text-stone-500">
						Paste a URL to embed a page, video, document, or prototype.
					</div>
				)}
			</div>
		</div>
	);
}
