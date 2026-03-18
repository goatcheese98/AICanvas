import { CanvasCard } from './CanvasCard';
import { CanvasDetailsDialog } from './CanvasDetailsDialog';
import { CanvasLibraryEmpty } from './CanvasLibraryEmpty';
import { CanvasLibraryError } from './CanvasLibraryError';
import { CanvasLibrarySkeleton } from './CanvasLibrarySkeleton';
import { CanvasLibraryToolbar } from './CanvasLibraryToolbar';
import { DeleteCanvasDialog } from './DeleteCanvasDialog';
import { useCanvasLibraryState } from './useCanvasLibraryState';

export function CanvasLibrary() {
	const {
		canvasesQuery,
		searchTerm,
		sortBy,
		isCreateDialogOpen,
		renameTarget,
		deleteTarget,
		deleteError,
		formState,
		formError,
		filtered,
		isCreating,
		isUpdating,
		isDeleting,
		setSortBy,
		setFormState,
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
	} = useCanvasLibraryState();

	if (canvasesQuery.isLoading) {
		return <CanvasLibrarySkeleton />;
	}

	if (canvasesQuery.isError) {
		return <CanvasLibraryError error={canvasesQuery.error} />;
	}

	return (
		<div className="space-y-5">
			<CanvasLibraryToolbar
				searchTerm={searchTerm}
				sortBy={sortBy}
				isCreating={isCreating}
				onSearchChange={handleSearchChange}
				onSortChange={setSortBy}
				onCreateClick={openCreateDialog}
			/>

			{filtered.length === 0 ? (
				<CanvasLibraryEmpty onCreateClick={openCreateDialog} />
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{filtered.map((canvas) => (
						<CanvasCard
							key={canvas.id}
							canvas={canvas}
							onOpen={() => handleNavigateToCanvas(canvas.id)}
							onRename={() => openRenameDialog(canvas)}
							onDelete={() => openDeleteDialog(canvas)}
							onToggleFavorite={() => handleToggleFavorite(canvas.id)}
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
					isSubmitting={isCreating}
					onChange={setFormState}
					onClose={closeCreateDialog}
					onSubmit={handleCreateSubmit}
				/>
			) : null}

			{renameTarget ? (
				<CanvasDetailsDialog
					title="Rename Canvas"
					submitLabel="Save Changes"
					value={formState}
					error={formError}
					isSubmitting={isUpdating}
					onChange={setFormState}
					onClose={closeRenameDialog}
					onSubmit={handleRenameSubmit}
				/>
			) : null}

			{deleteTarget ? (
				<DeleteCanvasDialog
					canvas={deleteTarget}
					error={deleteError}
					isDeleting={isDeleting}
					onClose={closeDeleteDialog}
					onConfirm={handleDeleteConfirm}
				/>
			) : null}
		</div>
	);
}
