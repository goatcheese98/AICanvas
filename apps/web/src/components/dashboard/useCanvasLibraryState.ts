import { api, getRequiredAuthHeaders } from '@/lib/api';
import type { Canvas } from '@ai-canvas/shared/types';
import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { startTransition, useDeferredValue, useMemo, useState } from 'react';
import type { CanvasFormState } from './canvas-library-types';
import { validateCanvasForm } from './canvas-library-utils';
import type { DashboardSortOption } from './dashboard-utils';
import { filterAndSortCanvases } from './dashboard-utils';

const DEFAULT_CREATE_FORM: CanvasFormState = {
	title: '',
	description: '',
	isPublic: false,
};

export function useCanvasLibraryState() {
	const { getToken } = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [searchTerm, setSearchTerm] = useState('');
	const [sortBy, setSortBy] = useState<DashboardSortOption>('recent');
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [renameTarget, setRenameTarget] = useState<Canvas | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Canvas | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [formState, setFormState] = useState<CanvasFormState>(DEFAULT_CREATE_FORM);
	const [formError, setFormError] = useState<string | null>(null);
	const deferredSearch = useDeferredValue(searchTerm);

	// Data fetching
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

	// Mutations
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
			setDeleteTarget(null);
			setDeleteError(null);
			void queryClient.invalidateQueries({ queryKey: ['canvases'] });
		},
		onError: (error) => {
			setDeleteError(
				error instanceof Error ? error.message : 'Failed to delete canvas. Please try again.',
			);
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

	// Derived state
	const canvases = canvasesQuery.data?.items ?? [];
	const filtered = useMemo(
		() => filterAndSortCanvases(canvases as Canvas[], deferredSearch, sortBy),
		[canvases, deferredSearch, sortBy],
	);

	// Actions
	const handleSearchChange = (value: string) => {
		startTransition(() => setSearchTerm(value));
	};

	const openCreateDialog = () => {
		setFormState(DEFAULT_CREATE_FORM);
		setFormError(null);
		setIsCreateDialogOpen(true);
	};

	const closeCreateDialog = () => {
		setIsCreateDialogOpen(false);
		setFormError(null);
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

	const closeRenameDialog = () => {
		setRenameTarget(null);
		setFormError(null);
	};

	const handleCreateSubmit = () => {
		const result = validateCanvasForm(formState, canvases as Canvas[], 'create');

		if (!result.valid) {
			setFormError(result.error);
			return;
		}

		if (result.data) {
			createCanvas.mutate(result.data);
		}
	};

	const handleRenameSubmit = () => {
		if (!renameTarget) return;

		const result = validateCanvasForm(formState, canvases as Canvas[], 'rename', renameTarget.id);

		if (!result.valid) {
			setFormError(result.error);
			return;
		}

		if (result.data) {
			updateCanvasMeta.mutate({
				id: renameTarget.id,
				data: result.data,
			});
		}
	};

	const openDeleteDialog = (canvas: Canvas) => {
		setDeleteError(null);
		setDeleteTarget(canvas);
	};

	const closeDeleteDialog = () => {
		setDeleteTarget(null);
		setDeleteError(null);
	};

	const handleDeleteConfirm = () => {
		if (deleteTarget) {
			deleteCanvas.mutate(deleteTarget.id);
		}
	};

	const handleToggleFavorite = (canvasId: string) => {
		toggleFavorite.mutate(canvasId);
	};

	const handleNavigateToCanvas = (canvasId: string) => {
		void navigate({ to: '/canvas/$id', params: { id: canvasId } });
	};

	return {
		// Query state
		canvasesQuery,
		// UI state
		searchTerm,
		sortBy,
		isCreateDialogOpen,
		renameTarget,
		deleteTarget,
		deleteError,
		formState,
		formError,
		// Derived data
		canvases,
		filtered,
		// Mutation states
		isCreating: createCanvas.isPending,
		isUpdating: updateCanvasMeta.isPending,
		isDeleting: deleteCanvas.isPending,
		// Setters
		setSortBy,
		setFormState,
		// Actions
		handleSearchChange,
		openCreateDialog,
		closeCreateDialog,
		openRenameDialog,
		closeRenameDialog,
		openDeleteDialog,
		closeDeleteDialog,
		handleCreateSubmit,
		handleRenameSubmit,
		handleDeleteConfirm,
		handleToggleFavorite,
		handleNavigateToCanvas,
	};
}
