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
	formatCanvasUpdatedAt,
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
		<div className="app-dialog-backdrop fixed inset-0 z-40 flex items-center justify-center p-4">
			<div className="app-panel app-panel-strong w-full max-w-xl overflow-hidden rounded-[18px]">
				<div className="border-b border-[var(--color-border)] px-6 py-5">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="app-kicker">Canvas Details</p>
							<h2 className="mt-3 text-2xl font-semibold text-[var(--color-text-primary)]">{title}</h2>
						</div>
						<button type="button" onClick={onClose} className="app-button app-button-secondary px-4 py-2.5">
							Close
						</button>
					</div>
				</div>

				<div className="space-y-4 px-6 py-6">
					<div>
						<label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
							Canvas Name
						</label>
						<input
							value={value.title}
							onChange={(event) => onChange({ ...value, title: event.target.value })}
							className="app-field"
							placeholder="Q2 experience strategy"
						/>
					</div>

					<div>
						<label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
							Description
						</label>
						<textarea
							value={value.description}
							onChange={(event) => onChange({ ...value, description: event.target.value })}
							className="app-field-multiline"
							placeholder="What this canvas is for"
						/>
					</div>

					<label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-[var(--color-border)] bg-white/72 px-4 py-4">
						<input
							type="checkbox"
							checked={value.isPublic}
							onChange={(event) => onChange({ ...value, isPublic: event.target.checked })}
							className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent-text)]"
						/>
						<div className="text-sm text-[var(--color-text-primary)]">Make canvas public</div>
					</label>

					{error ? (
						<div className="rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger-text)]">
							{error}
						</div>
					) : null}
				</div>

				<div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center justify-end gap-3">
						<button type="button" onClick={onClose} className="app-button app-button-secondary">
							Cancel
						</button>
						<button
							type="button"
							onClick={onSubmit}
							disabled={isSubmitting}
							className="app-button app-button-primary"
						>
							{submitLabel}
						</button>
					</div>
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
		<article className="app-panel app-panel-strong app-card-hover group flex h-full flex-col overflow-hidden rounded-[14px]">
			<div
				role="button"
				tabIndex={0}
				onClick={onOpen}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						onOpen();
					}
				}}
				className="flex flex-1 cursor-pointer flex-col text-left outline-none"
			>
				<div className="relative h-40 overflow-hidden border-b border-[var(--color-border)]">
					<CanvasPreviewThumbnail
						canvasId={canvas.id}
						title={canvas.title}
						thumbnailUrl={canvas.thumbnailUrl}
					/>

					<div className="absolute left-3 top-3 flex flex-wrap gap-2">
						<span className={canvas.isPublic ? 'app-badge app-badge-accent' : 'app-badge app-badge-muted'}>
							{canvas.isPublic ? 'Public' : 'Private'}
						</span>
						{canvas.isFavorite ? <span className="app-badge app-badge-muted">Favorite</span> : null}
					</div>

					<div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(250,251,252,0)_0%,rgba(250,251,252,0.96)_52%,rgba(250,251,252,1)_100%)] px-4 pb-3 pt-10">
						<div className="flex items-end justify-between gap-3">
							<div className="min-w-0">
								<div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
									Updated {formatCanvasUpdatedAt(canvas.updatedAt)}
								</div>
								<h3 className="mt-1.5 truncate text-lg font-semibold text-[var(--color-text-primary)]">
									{canvas.title}
								</h3>
							</div>
						</div>
					</div>
				</div>

				<div className="flex flex-1 flex-col px-4 py-4">
					<p className="min-h-10 text-[13px] leading-6 text-[var(--color-text-secondary)]">
						{canvas.description || 'No description yet.'}
					</p>
				</div>
			</div>

			<div className="border-t border-[var(--color-border)] px-4 py-3">
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							onRename();
						}}
						className="app-button app-button-secondary px-3.5 py-2.5"
					>
						Rename
					</button>
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							onToggleFavorite();
						}}
						className="app-button app-button-secondary px-3.5 py-2.5"
					>
						{canvas.isFavorite ? 'Unfavorite' : 'Favorite'}
					</button>
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							onDelete();
						}}
						className="app-button app-button-danger px-3.5 py-2.5"
					>
						Delete
					</button>
				</div>
			</div>
		</article>
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

	const openCreateDialog = () => {
		setFormState(DEFAULT_CREATE_FORM);
		setFormError(null);
		setIsCreateDialogOpen(true);
	};

	const openRenameDialog = (canvas: Canvas) => {
		setRenameTarget(canvas);
		setFormState({
			title: canvas.title,
			description: canvas.description ?? '',
			isPublic: canvas.isPublic,
		});
		setFormError(null);
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
			<div className="space-y-5">
				<div className="app-panel app-panel-strong h-[4.75rem] animate-pulse rounded-[18px] bg-white/70" />
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{Array.from({ length: 3 }).map((_, index) => (
						<div
							key={index}
							className="app-panel app-panel-strong h-[22rem] animate-pulse rounded-[14px] bg-white/70"
						/>
					))}
				</div>
			</div>
		);
	}

	if (canvasesQuery.isError) {
		return (
			<div className="app-panel app-panel-strong rounded-[28px] border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-6 py-8">
				<div className="app-kicker">Library Error</div>
				<div className="mt-4 text-2xl font-semibold text-[var(--color-danger-text)]">
					Unable to load your canvases.
				</div>
				<p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-danger-text)]">
					{canvasesQuery.error instanceof Error ? canvasesQuery.error.message : 'Failed to load canvases.'}
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="app-panel app-panel-strong rounded-[18px] px-4 py-4 sm:px-5">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
					<label className="relative min-w-0 flex-1">
						<span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]">
							<svg
								aria-hidden="true"
								viewBox="0 0 20 20"
								fill="none"
								className="h-4 w-4"
								stroke="currentColor"
								strokeWidth="1.7"
							>
								<circle cx="9" cy="9" r="5.25" />
								<path d="M13 13l3.5 3.5" strokeLinecap="round" />
							</svg>
						</span>
						<input
							value={searchTerm}
							onChange={(event) => {
								const value = event.target.value;
								startTransition(() => setSearchTerm(value));
							}}
							placeholder="Search canvases"
							className="app-input app-search-input"
						/>
					</label>

					<div className="flex flex-wrap items-center gap-2">
						{([
							['recent', 'Recent'],
							['alphabetical', 'A-Z'],
							['favorites', 'Favorites'],
						] as const).map(([value, label]) => (
							<button
								key={value}
								type="button"
								onClick={() => setSortBy(value)}
								className={`app-toolbar-chip ${sortBy === value ? 'app-toolbar-chip-active' : ''}`}
							>
								{label}
							</button>
						))}
					</div>

					<div className="lg:ml-auto">
						<button
							type="button"
							onClick={openCreateDialog}
							disabled={createCanvas.isPending}
							className="app-button app-button-primary w-full lg:w-auto"
						>
							New Canvas
						</button>
					</div>
				</div>
			</div>

			{filtered.length === 0 ? (
				<div className="app-panel app-panel-strong rounded-[16px] px-8 py-14 text-center">
					<div className="mx-auto max-w-xl">
						<h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">No canvases yet</h2>
						<p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
							Create your first canvas to get started.
						</p>
						<button type="button" onClick={openCreateDialog} className="app-button app-button-primary mt-6">
							Create Canvas
						</button>
					</div>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{filtered.map((canvas) => (
						<CanvasCard
							key={canvas.id}
							canvas={canvas}
							onOpen={() => void navigate({ to: '/canvas/$id', params: { id: canvas.id } })}
							onRename={() => openRenameDialog(canvas)}
							onDelete={() => deleteCanvas.mutate(canvas.id)}
							onToggleFavorite={() => toggleFavorite.mutate(canvas.id)}
						/>
					))}
				</div>
			)}

			{isCreateDialogOpen ? (
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
			) : null}

			{renameTarget ? (
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
			) : null}
		</div>
	);
}
