import { readCanvasVersion } from '@/components/canvas/canvas-persistence-utils';
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
import { Link, Navigate } from '@tanstack/react-router';
import { useCallback, useMemo, useRef, useState } from 'react';

interface PrototypeStudioPageProps {
	canvasId: string;
	prototypeId: string;
}

interface PrototypeStudioSessionProps {
	canvasId: string;
	prototypeElement: ExcalidrawElement & { customData: PrototypeOverlayCustomData };
	normalizedPrototype: PrototypeOverlayCustomData;
	savedSignature: string;
	elements: ExcalidrawElement[];
	canvasData: {
		appState?: Record<string, unknown> | null;
		files?: Record<string, unknown> | null;
	};
	canvasVersion: number | null;
	getToken: ReturnType<typeof useAuth>['getToken'];
	queryClient: ReturnType<typeof useQueryClient>;
}

function PrototypeStudioSession({
	canvasId,
	prototypeElement,
	normalizedPrototype,
	savedSignature,
	elements,
	canvasData,
	canvasVersion,
	getToken,
	queryClient,
}: PrototypeStudioSessionProps) {
	const [draft, setDraft] = useState(normalizedPrototype);
	const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>(
		'idle',
	);
	const canvasVersionRef = useRef<number | null>(canvasVersion);
	const hasVersionConflictRef = useRef(false);
	const draftSignature = useMemo(() => serializePrototypeState(draft), [draft]);
	const isDirty = draftSignature !== savedSignature;

	if (canvasVersion !== null && !hasVersionConflictRef.current) {
		canvasVersionRef.current = canvasVersion;
	}

	const handleDraftChange = useCallback((nextDraft: PrototypeOverlayCustomData) => {
		setDraft(nextDraft);
		setSaveState('idle');
	}, []);

	const saveDraft = useCallback(async () => {
		if (!isDirty) return;

		if (hasVersionConflictRef.current || typeof canvasVersionRef.current !== 'number') {
			setSaveState('conflict');
			return;
		}

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
						appState: (canvasData.appState ?? {}) as Record<string, unknown>,
						files: (canvasData.files ?? {}) as Record<string, unknown>,
						expectedVersion: canvasVersionRef.current,
					},
				},
				{ headers },
			);

			if (response.status === 409) {
				hasVersionConflictRef.current = true;
				setSaveState('conflict');
				return;
			}

			if (!response.ok) {
				throw new Error(await response.text());
			}

			const result = (await response.json()) as { success?: boolean; version?: number };
			if (!result.success || typeof result.version !== 'number') {
				throw new Error('Canvas save returned an invalid response.');
			}

			canvasVersionRef.current = result.version;
			hasVersionConflictRef.current = false;

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
	}, [
		canvasData.appState,
		canvasData.files,
		canvasId,
		draft,
		elements,
		getToken,
		isDirty,
		prototypeElement.id,
		queryClient,
	]);

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
								: saveState === 'conflict'
									? 'Refresh to sync'
									: saveState === 'error'
										? 'Save failed'
										: isDirty
											? 'Unsaved changes'
											: 'Up to date'}
					</div>
					<button
						type="button"
						onClick={() => void saveDraft()}
						disabled={!isDirty || saveState === 'saving'}
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
				<PrototypeStudioEditor value={draft} onChange={handleDraftChange} />
			</div>
		</div>
	);
}

export function PrototypeStudioPage({ canvasId, prototypeId }: PrototypeStudioPageProps) {
	const { getToken } = useAuth();
	const queryClient = useQueryClient();

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

	if (!matchedPrototypeElement && fallbackPrototypeElement) {
		return (
			<Navigate
				to="/canvas/$id/prototype/$prototypeId"
				params={{
					id: canvasId,
					prototypeId: fallbackPrototypeElement.id,
				}}
				replace
			/>
		);
	}

	if (!prototypeElement || !normalizedPrototype || !canvasQuery.data?.data) {
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
		<PrototypeStudioSession
			key={`${prototypeElement.id}:${savedSignature}`}
			canvasId={canvasId}
			prototypeElement={
				prototypeElement as ExcalidrawElement & { customData: PrototypeOverlayCustomData }
			}
			normalizedPrototype={normalizedPrototype}
			savedSignature={savedSignature}
			elements={elements}
			canvasData={canvasQuery.data.data}
			canvasVersion={readCanvasVersion(canvasQuery.data)}
			getToken={getToken}
			queryClient={queryClient}
		/>
	);
}
