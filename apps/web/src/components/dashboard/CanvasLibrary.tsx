import { startTransition, useDeferredValue, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { canvasSchemas } from '@ai-canvas/shared/schemas';
import type { Canvas } from '@ai-canvas/shared/types';
import { api, getRequiredAuthHeaders } from '@/lib/api';
import { CanvasPreviewThumbnail } from './CanvasPreviewThumbnail';
import {
	filterAndSortCanvases,
	hasCanvasTitleConflict,
	type DashboardSortOption,
} from './dashboard-utils';

interface CanvasFormState {
	title: string;
	description: string;
	isPublic: boolean;
}

const DEFAULT_CREATE_FORM: CanvasFormState = {
	title: '',
	description: '',
	isPublic: false,
};

function CanvasDetailsDialog({
	title,
	submitLabel,
	value,
	error,
	isSubmitting,
	onChange,
	onClose,
	onSubmit,
}: {
	title: string;
	submitLabel: string;
	value: CanvasFormState;
	error: string | null;
	isSubmitting: boolean;
	onChange: (next: CanvasFormState) => void;
	onClose: () => void;
	onSubmit: () => void;
}) {
	return (
		<div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/20 p-4 backdrop-blur-sm">
			<div className="w-full max-w-lg rounded-[32px] border border-stone-200 bg-white p-6 shadow-2xl">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="text-xl font-semibold text-stone-900">{title}</h2>
						<p className="mt-1 text-sm text-stone-500">
							Canvas names are validated and must be unique within your workspace.
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-stone-600"
					>
						Close
					</button>
				</div>

				<div className="mt-6 space-y-4">
					<div>
						<label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
							Canvas Name
						</label>
						<input
							value={value.title}
							onChange={(event) => onChange({ ...value, title: event.target.value })}
							className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 outline-none"
							placeholder="Product roadmap"
						/>
					</div>

					<div>
						<label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
							Description
						</label>
						<textarea
							value={value.description}
							onChange={(event) => onChange({ ...value, description: event.target.value })}
							className="min-h-28 w-full resize-none rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 outline-none"
							placeholder="What this canvas is for"
						/>
					</div>

					<label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
						<input
							type="checkbox"
							checked={value.isPublic}
							onChange={(event) => onChange({ ...value, isPublic: event.target.checked })}
						/>
						<span>Make canvas public</span>
					</label>

					{error ? (
						<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
							{error}
						</div>
					) : null}
				</div>

				<div className="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onClick={onClose}
						className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onSubmit}
						disabled={isSubmitting}
						className="rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
					>
						{submitLabel}
					</button>
				</div>
			</div>
		</div>
	);
}

function CanvasCard({
	canvas,
	onOpen,
	onRename,
	onDelete,
	onToggleFavorite,
}: {
	canvas: Canvas;
	onOpen: () => void;
	onRename: () => void;
	onDelete: () => void;
	onToggleFavorite: () => void;
}) {
	return (
		<div className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm transition-transform hover:-translate-y-1 hover:shadow-xl">
			<button
				type="button"
				onClick={onOpen}
				className="relative h-40 overflow-hidden text-left"
			>
				<CanvasPreviewThumbnail canvasId={canvas.id} title={canvas.title} />
				<div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-white via-white/88 to-transparent p-4">
					<div>
						<div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-600">
						{canvas.isPublic ? 'Public' : 'Private'}
						</div>
						<div className="mt-2 text-lg font-semibold text-stone-900">{canvas.title}</div>
					</div>
					<div className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-700">
						Open
					</div>
				</div>
			</button>

			<div className="flex flex-1 flex-col p-4">
				<p className="min-h-12 text-sm leading-relaxed text-stone-600">
					{canvas.description || 'No description yet.'}
				</p>
				<div className="mt-4 flex items-center justify-between gap-2 text-xs text-stone-500">
					<span>Updated {new Date(canvas.updatedAt).toLocaleDateString()}</span>
					<span>{canvas.isFavorite ? 'Favorited' : 'Standard'}</span>
				</div>
				<div className="mt-4 flex items-center gap-2">
					<button
						type="button"
						onClick={onRename}
						className="rounded-full border border-stone-300 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-700"
					>
						Rename
					</button>
					<button
						type="button"
						onClick={onToggleFavorite}
						className={`rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
							canvas.isFavorite
								? 'bg-amber-100 text-amber-800'
								: 'border border-stone-300 text-stone-700'
						}`}
					>
						{canvas.isFavorite ? 'Unfavorite' : 'Favorite'}
					</button>
					<button
						type="button"
						onClick={onDelete}
						className="rounded-full border border-rose-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700"
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	);
}

export function CanvasLibrary() {
	const { getToken } = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [searchTerm, setSearchTerm] = useState('');
	const [sortBy, setSortBy] = useState<DashboardSortOption>('recent');
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [renameTarget, setRenameTarget] = useState<Canvas | null>(null);
	const [formState, setFormState] = useState<CanvasFormState>(DEFAULT_CREATE_FORM);
	const [formError, setFormError] = useState<string | null>(null);
	const deferredSearch = useDeferredValue(searchTerm);

	const canvasesQuery = useQuery({
		queryKey: ['canvases'],
		queryFn: async () => {
			const headers = await getRequiredAuthHeaders(getToken);
			const response = await api.api.canvas.list.$get(
				{
					query: {
						limit: 100,
					},
				},
				{ headers },
			);

			if (!response.ok) {
				throw new Error(await response.text());
			}

			return response.json();
		},
	});

	const createCanvas = useMutation({
		mutationFn: async (payload: CanvasFormState) => {
			const headers = await getRequiredAuthHeaders(getToken);
			const response = await api.api.canvas.create.$post(
				{
					json: {
						title: payload.title,
						description: payload.description,
						isPublic: payload.isPublic,
					},
				},
				{ headers },
			);

			if (!response.ok) {
				throw new Error(await response.text());
			}

			return response.json();
		},
		onSuccess: (canvas) => {
			void queryClient.invalidateQueries({ queryKey: ['canvases'] });
			setIsCreateDialogOpen(false);
			setFormState(DEFAULT_CREATE_FORM);
			setFormError(null);
			void navigate({ to: '/canvas/$id', params: { id: canvas.id } });
		},
	});

	const updateCanvasMeta = useMutation({
		mutationFn: async (payload: { id: string; data: CanvasFormState }) => {
			const headers = await getRequiredAuthHeaders(getToken);
			const response = await api.api.canvas[':id'].meta.$patch(
				{
					param: { id: payload.id },
					json: {
						title: payload.data.title,
						description: payload.data.description,
						isPublic: payload.data.isPublic,
					},
				},
				{ headers },
			);

			if (!response.ok) {
				throw new Error(await response.text());
			}

			return response.json();
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['canvases'] });
			setRenameTarget(null);
			setFormState(DEFAULT_CREATE_FORM);
			setFormError(null);
		},
	});

	const deleteCanvas = useMutation({
		mutationFn: async (id: string) => {
			const headers = await getRequiredAuthHeaders(getToken);
			const response = await api.api.canvas[':id'].$delete({ param: { id } }, { headers });

			if (!response.ok) {
				throw new Error(await response.text());
			}
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['canvases'] });
		},
	});

	const toggleFavorite = useMutation({
		mutationFn: async (id: string) => {
			const headers = await getRequiredAuthHeaders(getToken);
			const response = await api.api.canvas[':id'].favorite.$post({ param: { id } }, { headers });

			if (!response.ok) {
				throw new Error(await response.text());
			}
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['canvases'] });
		},
	});

	const canvases = canvasesQuery.data?.items ?? [];
	const filtered = useMemo(
		() => filterAndSortCanvases(canvases as Canvas[], deferredSearch, sortBy),
		[canvases, deferredSearch, sortBy],
	);

	const validateForm = (mode: 'create' | 'rename') => {
		const schema = mode === 'create' ? canvasSchemas.create : canvasSchemas.update;
		const result = schema.safeParse({
			title: formState.title,
			description: formState.description,
			isPublic: formState.isPublic,
		});

		if (!result.success) {
			setFormError(result.error.issues[0]?.message ?? 'Please fix the highlighted fields.');
			return null;
		}

		if (
			hasCanvasTitleConflict(
				canvases as Canvas[],
				result.data.title ?? '',
				mode === 'rename' ? renameTarget?.id : undefined,
			)
		) {
			setFormError('You already have a canvas with that name.');
			return null;
		}

		setFormError(null);
		return result.data;
	};

	const handleCreateSubmit = () => {
		const parsed = validateForm('create');
		if (!parsed || !parsed.title) return;
			createCanvas.mutate({
				title: parsed.title,
				description: parsed.description ?? '',
				isPublic: parsed.isPublic ?? false,
			});
		};

	const handleRenameSubmit = () => {
		if (!renameTarget) return;
		const parsed = validateForm('rename');
		if (!parsed || !parsed.title) return;
		updateCanvasMeta.mutate({
			id: renameTarget.id,
			data: {
				title: parsed.title,
				description: parsed.description ?? '',
				isPublic: parsed.isPublic ?? false,
			},
		});
	};

	if (canvasesQuery.isLoading) {
		return (
			<div className="rounded-[28px] border border-stone-200 bg-white p-8 text-sm text-stone-500">
				Loading canvases...
			</div>
		);
	}

	if (canvasesQuery.isError) {
		return (
			<div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">
				{canvasesQuery.error instanceof Error ? canvasesQuery.error.message : 'Failed to load canvases.'}
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 rounded-[28px] border border-stone-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
				<div className="flex flex-1 items-center gap-3 rounded-full border border-stone-200 bg-stone-50 px-4 py-3">
					<span className="text-stone-400">Search</span>
					<input
						value={searchTerm}
						onChange={(event) => {
							const value = event.target.value;
							startTransition(() => setSearchTerm(value));
						}}
						placeholder="Find canvases by title or description"
						className="w-full border-0 bg-transparent text-sm text-stone-900 outline-none"
					/>
				</div>

				<div className="flex items-center gap-3">
					<select
						value={sortBy}
						onChange={(event) => setSortBy(event.target.value as DashboardSortOption)}
						className="rounded-full border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700"
					>
						<option value="recent">Recent</option>
						<option value="alphabetical">Alphabetical</option>
						<option value="favorites">Favorites</option>
					</select>

					<button
						type="button"
						onClick={() => {
							setFormState({
								title: '',
								description: '',
								isPublic: false,
							});
							setFormError(null);
							setIsCreateDialogOpen(true);
						}}
						disabled={createCanvas.isPending}
						className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
					>
						New Canvas
					</button>
				</div>
			</div>

			{filtered.length === 0 ? (
				<div className="rounded-[32px] border border-dashed border-stone-300 bg-white/80 px-8 py-16 text-center">
					<div className="text-sm uppercase tracking-[0.2em] text-stone-500">No Canvases</div>
					<h2 className="mt-3 text-2xl font-semibold text-stone-900">Start your next board</h2>
					<p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-stone-600">
						Create a canvas for notes, diagrams, kanban planning, or embedded research. The dashboard is now wired to the standalone Hono API.
					</p>
					<button
						type="button"
						onClick={() => {
							setFormState({
								title: '',
								description: '',
								isPublic: false,
							});
							setFormError(null);
							setIsCreateDialogOpen(true);
						}}
						className="mt-6 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white"
					>
						Create Canvas
					</button>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
					{filtered.map((canvas) => (
						<CanvasCard
							key={canvas.id}
							canvas={canvas}
							onOpen={() => void navigate({ to: '/canvas/$id', params: { id: canvas.id } })}
							onRename={() => {
								setRenameTarget(canvas as Canvas);
								setFormState({
									title: canvas.title,
									description: canvas.description ?? '',
									isPublic: canvas.isPublic,
								});
								setFormError(null);
							}}
							onDelete={() => deleteCanvas.mutate(canvas.id)}
							onToggleFavorite={() => toggleFavorite.mutate(canvas.id)}
						/>
					))}
				</div>
			)}

			{isCreateDialogOpen && (
				<CanvasDetailsDialog
					title="Create Canvas"
					submitLabel="Create Canvas"
					value={formState}
					error={formError}
					isSubmitting={createCanvas.isPending}
					onChange={setFormState}
					onClose={() => {
						setIsCreateDialogOpen(false);
						setFormError(null);
					}}
					onSubmit={handleCreateSubmit}
				/>
			)}

			{renameTarget && (
				<CanvasDetailsDialog
					title="Rename Canvas"
					submitLabel="Save Changes"
					value={formState}
					error={formError}
					isSubmitting={updateCanvasMeta.isPending}
					onChange={setFormState}
					onClose={() => {
						setRenameTarget(null);
						setFormError(null);
					}}
					onSubmit={handleRenameSubmit}
				/>
			)}
		</div>
	);
}
