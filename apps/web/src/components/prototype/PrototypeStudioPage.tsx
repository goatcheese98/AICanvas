import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import { PrototypeStudioEditor } from '@/components/overlays/prototype';
import { serializePrototypeState } from '@/components/overlays/prototype/prototype-utils';
import { FocusedViewHeader, ProjectShell } from '@/components/shell';
import { buildProjectResources } from '@/components/shell/project-resource-utils';
import type { ProjectResource } from '@/components/shell/types';
import { api, getRequiredAuthHeaders, toApiUrl } from '@/lib/api';
import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type { HeavyResourceRecord, PrototypeOverlayCustomData } from '@ai-canvas/shared/types';
import { useAuth } from '@clerk/clerk-react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';

interface PrototypeStudioPageProps {
	canvasId: string;
	prototypeId: string;
}

interface PrototypeStudioSessionProps {
	normalizedPrototype: PrototypeOverlayCustomData;
	projectName: string;
	canvasId: string;
}

const EMPTY_COLLABORATION = {
	isCollaborating: false,
	collaborators: new Map<string, { username?: string }>(),
	roomLink: null,
	sessionError: null,
	sessionStatus: 'idle' as const,
	username: 'Anonymous',
	setUsername: () => {},
	startSession: async () => {},
	stopSession: () => {},
};

function PrototypeStudioSession({
	normalizedPrototype,
	projectName,
	canvasId,
}: PrototypeStudioSessionProps) {
	const [draft, setDraft] = useState(normalizedPrototype);

	const handleDraftChange = useCallback((nextDraft: PrototypeOverlayCustomData) => {
		setDraft(nextDraft);
	}, []);

	return (
		<div className="flex h-full min-h-0 flex-col bg-[linear-gradient(135deg,#f8f6f0_0%,#ffffff_48%,#eef3ff_100%)]">
			<FocusedViewHeader
				projectName={projectName}
				resourceName={normalizedPrototype.title ?? 'Untitled Prototype'}
				canvasId={canvasId}
			/>

			<div className="min-h-0 flex-1 p-6">
				<PrototypeStudioEditor value={draft} onChange={handleDraftChange} />
			</div>
		</div>
	);
}

export function PrototypeStudioPage({ canvasId, prototypeId }: PrototypeStudioPageProps) {
	const { getToken } = useAuth();
	const navigate = useNavigate();

	const canvasQuery = useQuery({
		queryKey: ['canvas', canvasId],
		queryFn: async () => {
			const headers = await getRequiredAuthHeaders(getToken);
			const res = await api.api.canvas[':id'].$get({ param: { id: canvasId } }, { headers });
			if (!res.ok) throw new Error('Failed to load canvas');
			return res.json();
		},
	});

	const prototypeQuery = useQuery({
		queryKey: ['heavy-resource', canvasId, 'prototype', prototypeId],
		queryFn: async () => {
			const headers = await getRequiredAuthHeaders(getToken);
			const res = await fetch(
				toApiUrl(`/api/canvas/${canvasId}/resources/prototype/${prototypeId}`),
				{ headers },
			);
			if (!res.ok) throw new Error(await res.text());
			return (await res.json()) as HeavyResourceRecord;
		},
	});

	const elements = useMemo(
		() =>
			normalizeSceneElements(
				(canvasQuery.data?.data?.elements ?? []) as unknown as ExcalidrawElement[],
			),
		[canvasQuery.data?.data?.elements],
	);
	const prototypeResource = prototypeQuery.data ?? null;
	const normalizedPrototype = useMemo(
		() =>
			prototypeResource
				? normalizePrototypeOverlay(prototypeResource.data as PrototypeOverlayCustomData)
				: null,
		[prototypeResource],
	);
	const resources = useMemo(
		() =>
			buildProjectResources({
				canvasId,
				canvasName: canvasQuery.data?.canvas?.title ?? 'Untitled Project',
				elements,
			}),
		[canvasId, canvasQuery.data?.canvas?.title, elements],
	);
	const savedSignature = useMemo(
		() => (normalizedPrototype ? serializePrototypeState(normalizedPrototype) : ''),
		[normalizedPrototype],
	);

	if (canvasQuery.isLoading || prototypeQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
			</div>
		);
	}

	if (canvasQuery.isError || prototypeQuery.isError) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50 p-6">
				<div className="rounded-[24px] border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
					<div className="text-lg font-semibold text-stone-900">Prototype not found</div>
					<p className="mt-2 text-sm text-stone-600">
						{prototypeQuery.isError
							? 'The requested prototype could not be loaded from its resource record.'
							: 'The canvas data could not be loaded for this studio view.'}
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

	const handleNavigateToResource = (resource: ProjectResource) => {
		if (resource.type === 'board') {
			void navigate({
				to: '/canvas/$id/board/$boardId',
				params: {
					id: canvasId,
					boardId: resource.id,
				},
			});
			return;
		}

		if (resource.type === 'prototype') {
			void navigate({
				to: '/canvas/$id/prototype/$prototypeId',
				params: {
					id: canvasId,
					prototypeId: resource.id,
				},
			});
			return;
		}

		if (resource.type === 'document') {
			void navigate({
				to: '/canvas/$id/document/$documentId',
				params: { id: canvasId, documentId: resource.id },
			});
			return;
		}

		void navigate({
			to: '/canvas/$id',
			params: { id: canvasId },
		});
	};

	const handleNavigateToSettings = () => {
		void navigate({ to: '/dashboard' });
	};
	const projectName = canvasQuery.data?.canvas?.title ?? 'Untitled Project';
	const activeResourceId = prototypeResource?.id ?? prototypeId;

	if (!prototypeResource || !normalizedPrototype || !canvasQuery.data?.data) {
		return (
			<ProjectShell
				projectId="default"
				projectName={projectName}
				canvasId={canvasId}
				resources={resources}
				activeResourceId={activeResourceId}
				collaboration={EMPTY_COLLABORATION}
				onNavigateToResource={handleNavigateToResource}
				onNavigateToSettings={handleNavigateToSettings}
			>
				<div className="flex h-full items-center justify-center bg-stone-50 p-6">
					<div className="rounded-[24px] border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
						<div className="text-lg font-semibold text-stone-900">Prototype not found</div>
						<p className="mt-2 text-sm text-stone-600">
							The requested prototype could not be found. Try reopening it from the canvas.
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
			</ProjectShell>
		);
	}

	return (
		<ProjectShell
			projectId="default"
			projectName={projectName}
			canvasId={canvasId}
			resources={resources}
			activeResourceId={prototypeResource.id}
			collaboration={EMPTY_COLLABORATION}
			onNavigateToResource={handleNavigateToResource}
			onNavigateToSettings={handleNavigateToSettings}
		>
			<PrototypeStudioSession
				key={`${prototypeResource.id}:${savedSignature}`}
				normalizedPrototype={normalizedPrototype}
				projectName={projectName}
				canvasId={canvasId}
			/>
		</ProjectShell>
	);
}
