import { applyOverlayUpdateByType } from '@/components/canvas/overlay-registry';
import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import { PrototypeStudioEditor } from '@/components/overlays/prototype';
import { serializePrototypeState } from '@/components/overlays/prototype/prototype-utils';
import { api, getRequiredAuthHeaders } from '@/lib/api';
import { captureBrowserException } from '@/lib/observability';
import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type { PrototypeOverlayCustomData } from '@ai-canvas/shared/types';
import { useAuth } from '@clerk/clerk-react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useRef, useState } from 'react';

interface PrototypeStudioPageProps {
	canvasId: string;
	prototypeId: string;
}

export function PrototypeStudioPage({ canvasId, prototypeId }: PrototypeStudioPageProps) {
	const { getToken } = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState<PrototypeOverlayCustomData | null>(null);
	const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

	const canvasQuery = useQuery({
		queryKey: ['canvas', canvasId],
		queryFn: async () => {
			const headers = await getRequiredAuthHeaders(getToken);
			const res = await api.api.canvas[':id'].$get({ param: { id: canvasId } }, { headers });
			if (!res.ok) throw new Error('Failed to load canvas');
			return res.json();
		},
	});

	const elements = useMemo(
		() =>
			normalizeSceneElements(
				(canvasQuery.data?.data?.elements ?? []) as unknown as ExcalidrawElement[],
			),
		[canvasQuery.data?.data?.elements],
	);
	const prototypeElements = useMemo(
		() =>
			elements.filter(
				(element) => (element.customData as { type?: unknown } | undefined)?.type === 'prototype',
			),
		[elements],
	);
	const matchedPrototypeElement = useMemo(
		() => prototypeElements.find((element) => element.id === prototypeId) ?? null,
		[prototypeElements, prototypeId],
	);
	const fallbackPrototypeElement = useMemo(
		() => (matchedPrototypeElement ? null : (prototypeElements[0] ?? null)),
		[matchedPrototypeElement, prototypeElements],
	);
	const prototypeElement = matchedPrototypeElement ?? fallbackPrototypeElement;
	const normalizedPrototype = useMemo(
		() =>
			prototypeElement
				? normalizePrototypeOverlay(prototypeElement.customData as PrototypeOverlayCustomData)
				: null,
		[prototypeElement],
	);
	const savedSignature = useMemo(
		() => (normalizedPrototype ? serializePrototypeState(normalizedPrototype) : ''),
		[normalizedPrototype],
	);
	const draftSignature = useMemo(() => (draft ? serializePrototypeState(draft) : ''), [draft]);
	const isDirty = Boolean(draft && savedSignature && draftSignature !== savedSignature);

	// Track last normalized prototype to sync without useEffect
	const lastNormalizedSignatureRef = useRef<string>('');

	// Sync draft when normalized prototype changes (using useMemo pattern)
	useMemo(() => {
		if (!normalizedPrototype) return;
		
		if (savedSignature === lastNormalizedSignatureRef.current) {
			return;
		}
		lastNormalizedSignatureRef.current = savedSignature;
		setDraft(normalizedPrototype);
		setSaveState('idle');
	}, [normalizedPrototype, savedSignature]);

	// Track navigation state to avoid useEffect
	const navigatedFallbackRef = useRef<string | null>(null);

	// Handle navigation to fallback prototype using useMemo pattern
	useMemo(() => {
		if (!fallbackPrototypeElement || matchedPrototypeElement || canvasQuery.isLoading) {
			return;
		}

		// Prevent duplicate navigations
		if (navigatedFallbackRef.current === fallbackPrototypeElement.id) {
			return;
		}
		navigatedFallbackRef.current = fallbackPrototypeElement.id;

		void navigate({
			to: '/canvas/$id/prototype/$prototypeId',
			params: {
				id: canvasId,
				prototypeId: fallbackPrototypeElement.id,
			},
			replace: true,
		});
	}, [
		canvasId,
		canvasQuery.isLoading,
		fallbackPrototypeElement,
		matchedPrototypeElement,
		navigate,
	]);

	const activeDraft = draft ?? normalizedPrototype;

	async function saveDraft() {
		if (!draft || !prototypeElement || !canvasQuery.data?.data) return;

		setSaveState('saving');

		try {
			const nextElements = elements.map((element) => {
				if (element.id !== prototypeElement.id) return element;
				return applyOverlayUpdateByType(
					'prototype',
					element as ExcalidrawElement & { customData: PrototypeOverlayCustomData },
					{
						title: draft.title,
						template: draft.template,
						files: draft.files,
						dependencies: draft.dependencies,
						preview: draft.preview,
						activeFile: draft.activeFile,
						showEditor: draft.showEditor,
						showPreview: draft.showPreview,
					},
				) as unknown as ExcalidrawElement;
			});

			const headers = await getRequiredAuthHeaders(getToken);
			const response = await api.api.canvas[':id'].$put(
				{
					param: { id: canvasId },
					json: {
						elements: nextElements as Record<string, unknown>[],
						appState: (canvasQuery.data.data.appState ?? {}) as Record<string, unknown>,
						files: (canvasQuery.data.data.files ?? {}) as Record<string, unknown>,
					},
				},
				{ headers },
			);

			if (!response.ok) {
				throw new Error(await response.text());
			}

			await queryClient.invalidateQueries({ queryKey: ['canvas', canvasId] });
			setSaveState('saved');
		} catch (error) {
			console.error('Failed to save prototype draft', error);
			captureBrowserException(error, {
				tags: {
					area: 'prototype.studio',
					action: 'save_draft',
				},
				extra: {
					canvasId,
					prototypeId: prototypeElement.id,
				},
			});
			setSaveState('error');
		}
	}

	if (canvasQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
			</div>
		);
	}

	if (canvasQuery.isError) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50 p-6">
				<div className="rounded-[24px] border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
					<div className="text-lg font-semibold text-stone-900">Failed to load prototype</div>
					<p className="mt-2 text-sm text-stone-600">
						The canvas data could not be loaded for this studio view.
					</p>
					<Link
						to="/canvas/$id"
						params={{ id: canvasId }}
						className="mt-4 inline-flex rounded-full bg-stone-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
					>
						Back to Canvas
					</Link>
				</div>
			</div>
		);
	}

	if (!prototypeElement || !normalizedPrototype || !activeDraft) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50 p-6">
				<div className="rounded-[24px] border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
					<div className="text-lg font-semibold text-stone-900">Prototype not found</div>
					<p className="mt-2 text-sm text-stone-600">
						{prototypeElements.length === 0
							? 'This canvas does not currently have any prototype cards.'
							: 'The requested prototype could not be found. Try reopening it from the canvas.'}
					</p>
					<Link
						to="/canvas/$id"
						params={{ id: canvasId }}
						className="mt-4 inline-flex rounded-full bg-stone-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
					>
						Back to Canvas
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col bg-[linear-gradient(135deg,#f8f6f0_0%,#ffffff_48%,#eef3ff_100%)]">
			<div className="flex items-center justify-between gap-4 border-b border-stone-200 bg-white/90 px-6 py-4 backdrop-blur">
				<div>
					<div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
						Prototype Studio
					</div>
					<div className="mt-1 text-sm text-stone-600">
						Edit files outside the canvas. The canvas now renders the same live prototype runtime
						preview.
					</div>
				</div>
				<div className="flex items-center gap-3">
					<div className="text-xs text-stone-500">
						{saveState === 'saving'
							? 'Saving...'
							: saveState === 'saved'
								? 'Saved'
								: saveState === 'error'
									? 'Save failed'
									: draft && isDirty
										? 'Unsaved changes'
										: 'Up to date'}
					</div>
					<button
						type="button"
						onClick={() => void saveDraft()}
						disabled={!draft || !isDirty || saveState === 'saving'}
						className="rounded-full bg-stone-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-40"
					>
						Save
					</button>
					<Link
						to="/canvas/$id"
						params={{ id: canvasId }}
						className="rounded-full border border-stone-300 bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
					>
						Back to Canvas
					</Link>
				</div>
			</div>

			<div className="min-h-0 flex-1 p-6">
				<PrototypeStudioEditor value={activeDraft} onChange={setDraft} />
			</div>
		</div>
	);
}
