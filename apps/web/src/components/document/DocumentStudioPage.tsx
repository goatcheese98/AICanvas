import { buildPersistedCanvasData } from '@/components/canvas/canvas-persistence-utils';
import { applyOverlayUpdateToScene } from '@/components/canvas/overlay-registry';
import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import { LexicalNoteContainer } from '@/components/overlays/lexical';
import { ProjectShell } from '@/components/shell/ProjectShell';
import { buildProjectResources } from '@/components/shell/project-resource-utils';
import type { ProjectResource } from '@/components/shell/types';
import { useCollaboration } from '@/hooks/useCollaboration';
import { useMountEffect } from '@/hooks/useMountEffect';
import { api, getRequiredAuthHeaders, toApiUrl } from '@/lib/api';
import { useAppStore } from '@/stores/store';
import { normalizeNewLexOverlay } from '@ai-canvas/shared/schemas';
import type { HeavyResourceRecord, NewLexOverlayCustomData } from '@ai-canvas/shared/types';
import { useAuth } from '@clerk/clerk-react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { getOpenDocumentElements } from './document-studio-utils';

interface CanvasQueryData {
	canvas?: {
		title?: unknown;
		version?: unknown;
	};
	data?: {
		elements?: readonly ExcalidrawElement[];
		appState?: Record<string, unknown>;
		files?: Record<string, unknown> | null;
	};
}

interface DocumentStudioPageProps {
	canvasId: string;
	documentId: string;
}

interface DocumentStudioWorkspaceProps {
	canvasId: string;
	canvasTitle: string;
	documentElement: ExcalidrawElement & { customData: NewLexOverlayCustomData };
	initialElements: readonly ExcalidrawElement[];
	initialAppState: Record<string, unknown>;
	initialFiles: Record<string, unknown> | null;
	initialVersion: number;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function DocumentStudioWorkspace({
	canvasId,
	canvasTitle,
	documentElement,
	initialElements,
	initialAppState,
	initialFiles,
	initialVersion,
}: DocumentStudioWorkspaceProps) {
	const { getToken } = useAuth();
	const navigate = useNavigate();
	const addToast = useAppStore((s) => s.addToast);
	const collaboration = useCollaboration({
		onError: (message) => addToast({ message, type: 'error' }),
	});

	const [sceneElements, setSceneElements] = useState<readonly ExcalidrawElement[]>(initialElements);
	const [saveState, setSaveState] = useState<SaveState>('idle');
	const [saveError, setSaveError] = useState<string | null>(null);
	const sceneElementsRef = useRef(sceneElements);
	const appStateRef = useRef<Record<string, unknown>>(initialAppState);
	const filesRef = useRef<Record<string, unknown> | null>(initialFiles);
	const versionRef = useRef(initialVersion);
	const queuedCanvasDataRef = useRef<ReturnType<typeof buildPersistedCanvasData> | null>(null);
	const saveInFlightRef = useRef(false);
	const isMountedRef = useRef(true);

	sceneElementsRef.current = sceneElements;

	useMountEffect(() => {
		return () => {
			isMountedRef.current = false;
		};
	});

	const documentElements = useMemo(() => getOpenDocumentElements(sceneElements), [sceneElements]);
	const matchedDocumentElement = useMemo(
		() => documentElements.find((element) => element.id === documentElement.id) ?? null,
		[documentElements, documentElement.id],
	);
	const fallbackDocumentElement = useMemo(
		() => (matchedDocumentElement ? null : (documentElements[0] ?? null)),
		[matchedDocumentElement, documentElements],
	);
	const activeDocumentElement = matchedDocumentElement ?? fallbackDocumentElement;

	const resources = useMemo(
		() =>
			buildProjectResources({
				canvasId,
				canvasName: canvasTitle,
				elements: sceneElements,
			}),
		[canvasId, canvasTitle, sceneElements],
	);

	const handleNavigateToResource = useCallback(
		(resource: ProjectResource) => {
			if (resource.type === 'canvas') {
				void navigate({ to: '/canvas/$id', params: { id: canvasId } });
				return;
			}

			if (resource.type === 'board') {
				void navigate({
					to: '/canvas/$id/board/$boardId',
					params: { id: canvasId, boardId: resource.id },
				});
				return;
			}

			if (resource.type === 'prototype') {
				void navigate({
					to: '/canvas/$id/prototype/$prototypeId',
					params: { id: canvasId, prototypeId: resource.id },
				});
				return;
			}

			if (resource.type === 'document') {
				void navigate({
					to: '/canvas/$id/document/$documentId',
					params: { id: canvasId, documentId: resource.id },
				});
			}
		},
		[canvasId, navigate],
	);

	const flushQueuedSave = useCallback(async () => {
		if (saveInFlightRef.current) return;

		saveInFlightRef.current = true;

		try {
			while (queuedCanvasDataRef.current) {
				const nextCanvasData = queuedCanvasDataRef.current;
				queuedCanvasDataRef.current = null;

				if (isMountedRef.current) {
					setSaveState('saving');
					setSaveError(null);
				}

				const headers = await getRequiredAuthHeaders(getToken);
				const response = await api.api.canvas[':id'].$put(
					{
						param: { id: canvasId },
						json: {
							...nextCanvasData,
							expectedVersion: versionRef.current,
						},
					},
					{ headers },
				);

				if (!response.ok) {
					throw new Error(await response.text());
				}

				const result = (await response.json()) as { version: number };
				versionRef.current = result.version;

				if (isMountedRef.current) {
					setSaveState('saved');
				}
			}
		} catch (error) {
			queuedCanvasDataRef.current = null;
			if (isMountedRef.current) {
				setSaveState('error');
				setSaveError(error instanceof Error ? error.message : 'Failed to save document.');
			}
		} finally {
			saveInFlightRef.current = false;
		}
	}, [canvasId, getToken]);

	const queueSave = useCallback(
		(nextElements: readonly ExcalidrawElement[]) => {
			queuedCanvasDataRef.current = buildPersistedCanvasData(
				nextElements,
				appStateRef.current,
				filesRef.current,
			);

			if (!saveInFlightRef.current) {
				void flushQueuedSave();
			}
		},
		[flushQueuedSave],
	);

	const handleDocumentChange = useCallback(
		(
			elementId: string,
			updates: {
				title?: string;
				lexicalState?: string;
				comments?: NewLexOverlayCustomData['comments'];
			},
		) => {
			const { didChange, nextElements } = applyOverlayUpdateToScene(
				sceneElementsRef.current,
				elementId,
				'newlex',
				updates,
			);
			if (!didChange) return;

			sceneElementsRef.current = nextElements;
			setSceneElements(nextElements);
			queueSave(nextElements);
		},
		[queueSave],
	);

	const saveCopy =
		saveState === 'saving'
			? 'Saving changes'
			: saveState === 'saved'
				? 'Saved'
				: saveState === 'error'
					? 'Save failed'
					: 'Ready';

	if (!activeDocumentElement) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50 p-6">
				<div className="rounded-[24px] border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
					<div className="text-lg font-semibold text-stone-900">Document not found</div>
					<p className="mt-2 text-sm text-stone-600">
						{documentElements.length === 0
							? 'This canvas does not currently have any document cards.'
							: 'The requested document could not be found. Try reopening it from the canvas.'}
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
		<ProjectShell
			projectId={canvasId}
			projectName={canvasTitle}
			canvasId={canvasId}
			resources={resources}
			activeResourceId={activeDocumentElement.id}
			collaboration={collaboration}
			onNavigateToResource={handleNavigateToResource}
		>
			<div className="flex h-full min-h-0 flex-col bg-[var(--color-canvas-bg)]">
				<div className="flex items-center justify-between gap-4 border-b border-stone-200 bg-white/90 px-6 py-4 backdrop-blur">
					<div className="min-w-0">
						<div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
							Document Studio
						</div>
						<div className="mt-1 max-w-2xl text-sm text-stone-600">
							Document editing now happens here. The canvas keeps a read-only document reference.
						</div>
					</div>
					<div className="flex items-center gap-3">
						<div
							className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500"
							title={saveState === 'error' && saveError ? saveError : saveCopy}
						>
							{saveState === 'error' && saveError ? 'Save error' : saveCopy}
						</div>
						<Link
							to="/canvas/$id"
							params={{ id: canvasId }}
							className="rounded-full border border-stone-300 bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
						>
							Back to Canvas
						</Link>
					</div>
				</div>

				<div className="min-h-0 flex-1 p-4">
					<div className="h-full min-h-0 overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_24px_60px_-44px_rgba(15,23,42,0.28)]">
						<LexicalNoteContainer
							element={activeDocumentElement}
							mode="shell"
							isSelected
							isActive
							onChange={handleDocumentChange}
							onActivityChange={undefined}
						/>
					</div>
				</div>
			</div>
		</ProjectShell>
	);
}

export function DocumentStudioPage({ canvasId, documentId }: DocumentStudioPageProps) {
	const { getToken } = useAuth();
	const canvasQuery = useQuery({
		queryKey: ['canvas', canvasId],
		queryFn: async () => {
			const headers = await getRequiredAuthHeaders(getToken);
			const res = await api.api.canvas[':id'].$get({ param: { id: canvasId } }, { headers });
			if (!res.ok) throw new Error('Failed to load canvas');
			return res.json();
		},
		refetchOnMount: 'always',
	});
	const documentQuery = useQuery({
		queryKey: ['heavy-resource', canvasId, 'document', documentId],
		queryFn: async () => {
			const headers = await getRequiredAuthHeaders(getToken);
			const res = await fetch(
				toApiUrl(`/api/canvas/${canvasId}/resources/document/${documentId}`),
				{ headers },
			);
			if (!res.ok) throw new Error(await res.text());
			return (await res.json()) as HeavyResourceRecord;
		},
	});

	const canvasData = canvasQuery.data as CanvasQueryData | undefined;
	const canvasTitle =
		typeof canvasData?.canvas?.title === 'string' ? canvasData.canvas.title : 'Untitled Project';
	const canvasVersion =
		typeof canvasData?.canvas?.version === 'number' && canvasData.canvas.version > 0
			? canvasData.canvas.version
			: 1;

	const normalizedElements = useMemo(
		() =>
			normalizeSceneElements(
				(canvasData?.data?.elements ?? []) as unknown as readonly ExcalidrawElement[],
			),
		[canvasData?.data?.elements],
	);
	const documentResource = documentQuery.data ?? null;
	const normalizedDocument = useMemo(
		() =>
			documentResource
				? normalizeNewLexOverlay(documentResource.data as NewLexOverlayCustomData)
				: null,
		[documentResource],
	);
	const mergedElements = useMemo(
		() =>
			normalizedDocument
				? normalizedElements.map((element) =>
						element.id === documentId
							? {
									...element,
									customData: normalizedDocument,
								}
							: element,
					)
				: normalizedElements,
		[documentId, normalizedDocument, normalizedElements],
	);
	const documentElements = useMemo(
		() => getOpenDocumentElements(mergedElements),
		[mergedElements],
	);
	const matchedDocumentElement = useMemo(
		() => documentElements.find((element) => element.id === documentId) ?? null,
		[documentElements, documentId],
	);
	const fallbackDocumentElement = useMemo(
		() => (matchedDocumentElement ? null : (documentElements[0] ?? null)),
		[matchedDocumentElement, documentElements],
	);

	if (canvasQuery.isLoading || documentQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
			</div>
		);
	}

	if (canvasQuery.isError || documentQuery.isError) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50 p-6">
				<div className="rounded-[24px] border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
					<div className="text-lg font-semibold text-stone-900">Failed to load document</div>
					<p className="mt-2 text-sm text-stone-600">
						{documentQuery.isError
							? 'The requested document could not be loaded from its resource record.'
							: 'The canvas data could not be loaded for this document view.'}
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

	if (!matchedDocumentElement && fallbackDocumentElement) {
		return (
			<Navigate
				to="/canvas/$id/document/$documentId"
				params={{
					id: canvasId,
					documentId: fallbackDocumentElement.id,
				}}
				replace
			/>
		);
	}

	if (!matchedDocumentElement || !canvasData?.data) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50 p-6">
				<div className="rounded-[24px] border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
					<div className="text-lg font-semibold text-stone-900">Document not found</div>
					<p className="mt-2 text-sm text-stone-600">
						{documentElements.length === 0
							? 'This canvas does not currently have any document cards.'
							: 'The requested document could not be found. Try reopening it from the canvas.'}
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
		<DocumentStudioWorkspace
			canvasId={canvasId}
			canvasTitle={canvasTitle}
			documentElement={matchedDocumentElement}
			initialElements={mergedElements}
			initialAppState={canvasData.data.appState ?? {}}
			initialFiles={canvasData.data.files ?? null}
			initialVersion={canvasVersion}
		/>
	);
}
