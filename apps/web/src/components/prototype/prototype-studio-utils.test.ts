import { describe, expect, it } from 'vitest';
import {
	getPrototypeStudioStatusCopy,
	shouldSyncPrototypeStudioDraft,
} from './prototype-studio-utils';

describe('prototype-studio-utils', () => {
	it('returns workflow-specific save status copy', () => {
		expect(getPrototypeStudioStatusCopy({ saveState: 'saving', isDirty: true })).toBe(
			'Saving to canvas...',
		);
		expect(getPrototypeStudioStatusCopy({ saveState: 'saved', isDirty: false })).toBe(
			'Saved to canvas.',
		);
		expect(getPrototypeStudioStatusCopy({ saveState: 'error', isDirty: true })).toBe(
			'Save failed. Changes are still local to this studio.',
		);
		expect(getPrototypeStudioStatusCopy({ saveState: 'idle', isDirty: true })).toBe(
			'Unsaved changes. Save to push edits back to the canvas.',
		);
		expect(getPrototypeStudioStatusCopy({ saveState: 'idle', isDirty: false })).toBe(
			'All changes saved to canvas.',
		);
	});

	it('only syncs server state into the draft when local edits are not ahead', () => {
		expect(
			shouldSyncPrototypeStudioDraft({
				draftSignature: '',
				persistedSignature: 'saved-v1',
				nextPersistedSignature: 'saved-v2',
			}),
		).toBe(true);

		expect(
			shouldSyncPrototypeStudioDraft({
				draftSignature: 'saved-v1',
				persistedSignature: 'saved-v1',
				nextPersistedSignature: 'saved-v2',
			}),
		).toBe(true);

		expect(
			shouldSyncPrototypeStudioDraft({
				draftSignature: 'saved-v2',
				persistedSignature: 'saved-v1',
				nextPersistedSignature: 'saved-v2',
			}),
		).toBe(true);

		expect(
			shouldSyncPrototypeStudioDraft({
				draftSignature: 'local-draft',
				persistedSignature: 'saved-v1',
				nextPersistedSignature: 'saved-v2',
			}),
		).toBe(false);
	});
});
