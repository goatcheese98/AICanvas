export type PrototypeStudioSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface PrototypeStudioStatusCopyOptions {
	saveState: PrototypeStudioSaveState;
	isDirty: boolean;
}

interface ShouldSyncPrototypeStudioDraftOptions {
	draftSignature: string;
	persistedSignature: string;
	nextPersistedSignature: string;
}

export function getPrototypeStudioStatusCopy({
	saveState,
	isDirty,
}: PrototypeStudioStatusCopyOptions) {
	switch (saveState) {
		case 'saving':
			return 'Saving to canvas...';
		case 'saved':
			return 'Saved to canvas.';
		case 'error':
			return 'Save failed. Changes are still local to this studio.';
		default:
			return isDirty
				? 'Unsaved changes. Save to push edits back to the canvas.'
				: 'All changes saved to canvas.';
	}
}

export function shouldSyncPrototypeStudioDraft({
	draftSignature,
	persistedSignature,
	nextPersistedSignature,
}: ShouldSyncPrototypeStudioDraftOptions) {
	if (!draftSignature) {
		return true;
	}

	return draftSignature === persistedSignature || draftSignature === nextPersistedSignature;
}
