import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useBlocker, useNavigate } from '@tanstack/react-router';
import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type { PrototypeOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { api, getRequiredAuthHeaders } from '@/lib/api';
import { captureBrowserException } from '@/lib/observability';
import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import { applyOverlayUpdateByType } from '@/components/canvas/overlay-registry';
import { PrototypeStudioEditor } from '@/components/overlays/prototype';
import { serializePrototypeState } from '@/components/overlays/prototype/prototype-utils';
import {
	getPrototypeStudioStatusCopy,
	shouldSyncPrototypeStudioDraft,
} from './prototype-studio-utils';

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
	const [persistedSignature, setPersistedSignature] = useState('');
	const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
	const persistedSignatureRef = useRef('');

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
	const activeDraft = draft ?? normalizedPrototype;
	const draftSignature = useMemo(
		() => (activeDraft ? serializePrototypeState(activeDraft) : ''),
		[activeDraft],
	);
	const baselineSignature = persistedSignature || savedSignature;
	const isDirty = Boolean(activeDraft && draftSignature !== baselineSignature);
	const saveStatusText = getPrototypeStudioStatusCopy({ saveState, isDirty });

	useEffect(() => {
		if (!normalizedPrototype) return;

		setDraft((currentDraft) => {
			const currentSignature = currentDraft ? serializePrototypeState(currentDraft) : '';
			return shouldSyncPrototypeStudioDraft({
				draftSignature: currentSignature,
				persistedSignature: persistedSignatureRef.current,
				nextPersistedSignature: savedSignature,
			})
				? normalizedPrototype
				: currentDraft;
		});
		persistedSignatureRef.current = savedSignature;
		setPersistedSignature(savedSignature);
		setSaveErrorMessage(null);
	}, [normalizedPrototype, savedSignature]);

	useEffect(() => {
		if (saveState !== 'saved') return;

		const timeoutId = window.setTimeout(() => {
			setSaveState((current) => (current === 'saved' ? 'idle' : current));
		}, 2200);

		return () => window.clearTimeout(timeoutId);
	}, [saveState]);

	useEffect(() => {
		if (!fallbackPrototypeElement || matchedPrototypeElement || canvasQuery.isLoading) {
			return;
		}

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

	const navigationBlocker = useBlocker({
		shouldBlockFn: () => isDirty,
		enableBeforeUnload: () => isDirty,
		withResolver: true,
		disabled: !isDirty,
	});

	const saveDraft = useEffectEvent(async () => {
		if (!activeDraft || !prototypeElement || !canvasQuery.data?.data) {
			return false;
		}

		setSaveState('saving');
		setSaveErrorMessage(null);

		try {
			const nextElements = elements.map((element) => {
				if (element.id !== prototypeElement.id) return element;
				return applyOverlayUpdateByType(
					'prototype',
					element as ExcalidrawElement & { customData: PrototypeOverlayCustomData },
					{
						title: activeDraft.title,
						template: activeDraft.template,
						files: activeDraft.files,
						dependencies: activeDraft.dependencies,
						preview: activeDraft.preview,
						activeFile: activeDraft.activeFile,
						showEditor: activeDraft.showEditor,
						showPreview: activeDraft.showPreview,
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

			const nextPersistedSignature = serializePrototypeState(activeDraft);
			persistedSignatureRef.current = nextPersistedSignature;
			setPersistedSignature(nextPersistedSignature);
			await queryClient.invalidateQueries({ queryKey: ['canvas', canvasId] });
			setSaveState('saved');
			return true;
		} catch (error) {
			console.error('Failed to save prototype draft', error);
			const message =
				error instanceof Error && error.message.trim().length > 0
					? error.message
					: 'Failed to save prototype draft.';
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
			setSaveErrorMessage(message);
			return false;
		}
	});

	const saveAndLeave = useEffectEvent(async () => {
		const didSave = await saveDraft();
		if (didSave && navigationBlocker.status === 'blocked') {
			navigationBlocker.proceed();
		}
	});

	useEffect(() => {
		const handleKeydown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
				event.preventDefault();
				if (!isDirty || saveState === 'saving') {
					return;
				}

				void saveDraft();
			}
		};

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	}, [isDirty, saveDraft, saveState]);

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
						Edit files outside the canvas. Changes stay local to this studio until you save them
						back to the canvas.
					</div>
				</div>
				<div className="flex items-center gap-3">
					<div className="text-right">
						<div className="text-xs text-stone-500" aria-live="polite">
							{saveStatusText}
						</div>
						<div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
							Cmd/Ctrl+S to save
						</div>
					</div>
					<button
						type="button"
						onClick={() => void saveDraft()}
						disabled={!activeDraft || !isDirty || saveState === 'saving'}
						className="rounded-full bg-stone-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-40"
					>
						{saveState === 'saving' ? 'Saving...' : 'Save'}
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

			{navigationBlocker.status === 'blocked' ? (
				<div className="app-dialog-backdrop fixed inset-0 z-40 flex items-center justify-center p-4">
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby="prototype-leave-dialog-title"
						className="app-panel app-panel-strong w-full max-w-lg overflow-hidden rounded-[20px] border border-stone-200 bg-white/96 shadow-[0_32px_80px_rgba(15,23,42,0.18)] backdrop-blur"
					>
						<div className="px-6 py-6">
							<h2
								id="prototype-leave-dialog-title"
								className="text-xl font-semibold text-stone-900"
							>
								Leave without saving?
							</h2>
							<p className="mt-3 text-sm leading-6 text-stone-600">
								Changes to <span className="font-semibold text-stone-900">{activeDraft.title}</span>{' '}
								are still local to Prototype Studio. Save first if you want the canvas version to
								match what you see here.
							</p>
							{saveErrorMessage ? (
								<div className="mt-4 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
									{saveErrorMessage}
								</div>
							) : null}
						</div>
						<div className="flex flex-wrap items-center justify-end gap-3 border-t border-stone-200 px-6 py-4">
							<button
								type="button"
								onClick={() => navigationBlocker.reset()}
								disabled={saveState === 'saving'}
								className="rounded-full border border-stone-300 bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
							>
								Continue editing
							</button>
							<button
								type="button"
								onClick={() => navigationBlocker.proceed()}
								disabled={saveState === 'saving'}
								className="rounded-full border border-stone-300 bg-stone-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
							>
								Discard changes
							</button>
							<button
								type="button"
								onClick={() => void saveAndLeave()}
								disabled={saveState === 'saving'}
								className="rounded-full bg-stone-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-40"
							>
								{saveState === 'saving' ? 'Saving...' : 'Save and leave'}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
