import { getMicrolinkApiUrl } from '@/lib/web-embed-utils';
import { useEffect, useState } from 'react';

interface WebEmbedPreviewCardProps {
	url: string;
	warning?: string;
	width: number;
	height: number;
	mode: 'preview' | 'shell' | 'live';
}

interface MicrolinkPreviewData {
	title?: string;
	description?: string;
	publisher?: string;
	url?: string;
	author?: string;
	image?: { url?: string | null } | null;
	logo?: { url?: string | null } | null;
	screenshot?: { url?: string | null } | null;
}

interface MicrolinkApiResponse {
	status?: string;
	data?: MicrolinkPreviewData;
}

function getPreviewImageUrl(data: MicrolinkPreviewData | null): string | null {
	return data?.screenshot?.url || data?.image?.url || null;
}

function getSummaryClampStyle(lines: number) {
	return {
		display: '-webkit-box',
		WebkitBoxOrient: 'vertical' as const,
		WebkitLineClamp: lines,
		overflow: 'hidden',
	};
}

export function WebEmbedPreviewCard({
	url,
	warning,
	width,
	height,
	mode,
}: WebEmbedPreviewCardProps) {
	const [preview, setPreview] = useState<MicrolinkPreviewData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();

		setIsLoading(true);
		setError(null);
		setPreview(null);

		fetch(getMicrolinkApiUrl(url), { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`Preview request failed with status ${response.status}`);
				}

				const payload = (await response.json()) as MicrolinkApiResponse;
				if (!payload.data) {
					throw new Error('Preview response did not include data');
				}

				setPreview(payload.data);
			})
			.catch((fetchError: unknown) => {
				if (controller.signal.aborted) {
					return;
				}

				setError(fetchError instanceof Error ? fetchError.message : 'Preview failed to load');
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setIsLoading(false);
				}
			});

		return () => controller.abort();
	}, [url]);

	const previewImageUrl = getPreviewImageUrl(preview);
	const displayTitle = preview?.title || preview?.publisher || new URL(url).hostname;
	const displayDescription = preview?.description || preview?.author || preview?.url || url;
	const isShellMode = mode === 'shell';
	const previewHeight = isShellMode
		? Math.max(360, Math.min(560, Math.round(height * 0.68)))
		: Math.max(220, Math.min(300, Math.round(height * 0.36)));
	const isVeryNarrow = width < 560;
	const summaryClampLines = isShellMode ? 5 : isVeryNarrow ? 3 : 4;

	return (
		<div className={`flex h-full overflow-auto ${isShellMode ? 'p-0' : 'p-4 sm:p-5'}`}>
			<div className="flex w-full flex-col gap-3">
				{warning ? (
					<div
						className={`mx-auto w-full rounded-2xl border border-amber-200 bg-amber-100 px-4 py-3 text-sm text-amber-900 ${
							isShellMode ? '' : 'max-w-[1040px]'
						}`}
					>
						{warning}
					</div>
				) : null}

				<div
					className={`mx-auto w-full overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.12)] ${
						isShellMode ? 'h-full min-h-0' : 'max-w-[1040px]'
					}`}
				>
					<div
						className="overflow-hidden border-b border-stone-200 bg-stone-100/70"
						style={{ minHeight: previewHeight, height: previewHeight }}
					>
						{previewImageUrl ? (
							<img
								src={previewImageUrl}
								alt={displayTitle}
								className="h-full w-full object-cover object-top"
								loading="lazy"
								referrerPolicy="no-referrer"
							/>
						) : (
							<div className="flex h-full items-center justify-center text-sm text-stone-500">
								{isLoading ? 'Loading preview...' : 'Preview image unavailable'}
							</div>
						)}
					</div>

					<div className={`space-y-3 ${isShellMode ? 'p-5 lg:p-6' : 'p-4 sm:p-5'}`}>
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								{preview?.logo?.url ? (
									<img
										src={preview.logo.url}
										alt=""
										aria-hidden="true"
										className="h-11 w-11 rounded-xl border border-stone-200 object-contain p-2"
										loading="lazy"
										referrerPolicy="no-referrer"
									/>
								) : null}
								<div className="min-w-0">
									<p
										className={`text-stone-900 ${isVeryNarrow ? 'text-base font-semibold' : 'text-lg font-semibold'}`}
										style={getSummaryClampStyle(2)}
									>
										{displayTitle}
									</p>
									<p className="truncate text-sm text-stone-500">
										{preview?.publisher || new URL(url).hostname}
									</p>
								</div>
							</div>

							<p
								className="text-sm leading-6 text-stone-600 sm:text-[15px]"
								style={getSummaryClampStyle(summaryClampLines)}
							>
								{isLoading ? 'Loading preview metadata...' : displayDescription}
							</p>

							{error ? (
								<p className="text-sm text-rose-600">
									Preview fallback failed. Open the link in a new tab.
								</p>
							) : !previewImageUrl && !isLoading ? (
								<p className="text-sm text-stone-500">
									Preview image unavailable for this site, but the metadata is still usable.
								</p>
							) : null}
						</div>

						<div className="flex flex-wrap items-center gap-3 pt-1">
							<a
								href={url}
								target="_blank"
								rel="noreferrer"
								className="inline-flex rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
							>
								Open source
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
