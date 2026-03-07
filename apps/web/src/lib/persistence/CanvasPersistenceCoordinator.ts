export interface CanvasData {
	elements: any[];
	appState: Record<string, any>;
	files: Record<string, any> | null;
}

export interface PersistenceState {
	isSaving: boolean;
	lastSaved: Date | null;
	hasUnsavedChanges: boolean;
}

interface SaveData {
	version: number;
	canvasData: CanvasData;
	savedAt: number;
	canvasId: string | null;
}

export interface CanvasStorageSnapshot {
	canvasData: CanvasData;
	savedAt: number;
	canvasId: string | null;
}

const STORAGE_KEY_PREFIX = 'excalidraw-canvas-data';
const STORAGE_VERSION = 2;
const SAVE_DEBOUNCE_MS = 1000;

interface CoordinatorOptions {
	onStateChange?: (state: PersistenceState) => void;
}

export class CanvasPersistenceCoordinator {
	private saveTimeout: ReturnType<typeof setTimeout> | null = null;
	private _lastSaved: Date | null = null;
	private _isSaving = false;
	private _hasUnsavedChanges = false;
	private onStateChange?: (state: PersistenceState) => void;

	constructor(options: CoordinatorOptions = {}) {
		this.onStateChange = options.onStateChange;
	}

	getState(): PersistenceState {
		return {
			isSaving: this._isSaving,
			lastSaved: this._lastSaved,
			hasUnsavedChanges: this._hasUnsavedChanges,
		};
	}

	private emitStateChange(): void {
		this.onStateChange?.(this.getState());
	}

	private getStorageKey(canvasId: string | null): string {
		return canvasId ? `${STORAGE_KEY_PREFIX}:${canvasId}` : STORAGE_KEY_PREFIX;
	}

	loadSnapshotFromStorage(canvasId: string | null): CanvasStorageSnapshot | null {
		try {
			const keyedSaved = localStorage.getItem(this.getStorageKey(canvasId));
			const legacySaved = localStorage.getItem(STORAGE_KEY_PREFIX);
			const saved = keyedSaved ?? legacySaved;
			if (!saved) return null;

			const data: SaveData = JSON.parse(saved);

			if (data.version !== STORAGE_VERSION) {
				console.warn('Canvas version mismatch, clearing');
				localStorage.removeItem(this.getStorageKey(canvasId));
				localStorage.removeItem(STORAGE_KEY_PREFIX);
				return null;
			}

			if (!data.canvasData) return null;
			if (canvasId && data.canvasId && data.canvasId !== canvasId) return null;

			return {
				canvasData: data.canvasData,
				savedAt: data.savedAt,
				canvasId: data.canvasId,
			};
		} catch (err) {
			console.error('Failed to load canvas from localStorage:', err);
			localStorage.removeItem(this.getStorageKey(canvasId));
			localStorage.removeItem(STORAGE_KEY_PREFIX);
			return null;
		}
	}

	loadFromStorage(canvasId: string | null): CanvasData | null {
		return this.loadSnapshotFromStorage(canvasId)?.canvasData ?? null;
	}

	scheduleSave(canvasData: CanvasData, canvasId: string | null): void {
		if (this.saveTimeout) clearTimeout(this.saveTimeout);

		this._hasUnsavedChanges = true;
		this.emitStateChange();

		this.saveTimeout = setTimeout(() => {
			this.executeSave(canvasData, canvasId);
		}, SAVE_DEBOUNCE_MS);
	}

	cancelPendingSave(): void {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}
	}

	forceSave(canvasData: CanvasData, canvasId: string | null): void {
		this.cancelPendingSave();
		this.executeSave(canvasData, canvasId);
	}

	clearStorage(canvasId: string | null): void {
		localStorage.removeItem(this.getStorageKey(canvasId));
		if (!canvasId) {
			localStorage.removeItem(STORAGE_KEY_PREFIX);
		}
		this._lastSaved = null;
		this._hasUnsavedChanges = false;
		this.emitStateChange();
	}

	dispose(): void {
		this.cancelPendingSave();
	}

	private isQuotaError(err: unknown): boolean {
		return (
			err instanceof DOMException &&
			(err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
		);
	}

	private stripMarkdownImages(canvasData: CanvasData): CanvasData {
		const elements = canvasData.elements.map((el: any) => {
			if (el.customData?.images && Object.keys(el.customData.images).length > 0) {
				return { ...el, customData: { ...el.customData, images: {} } };
			}
			return el;
		});
		return { ...canvasData, elements };
	}

	private stripAllImages(canvasData: CanvasData): CanvasData {
		const elements = canvasData.elements.map((el: any) => {
			if (el.customData?.images) {
				return { ...el, customData: { ...el.customData, images: {} } };
			}
			return el;
		});
		return { ...canvasData, elements, files: {} };
	}

	private executeSave(canvasData: CanvasData, canvasId: string | null): void {
		this._isSaving = true;
		this.emitStateChange();

		const persist = (data: CanvasData): void => {
			const dataToSave: SaveData = {
				version: STORAGE_VERSION,
				canvasData: data,
				savedAt: Date.now(),
				canvasId,
			};
			localStorage.setItem(this.getStorageKey(canvasId), JSON.stringify(dataToSave));
		};

		const markSaved = (): void => {
			this._lastSaved = new Date();
			this._hasUnsavedChanges = false;
			this._isSaving = false;
			this.emitStateChange();
		};

		// Attempt 1: full save
		try {
			persist(canvasData);
			markSaved();
			return;
		} catch (err) {
			if (!this.isQuotaError(err)) {
				this._isSaving = false;
				this.emitStateChange();
				console.error('Failed to save canvas:', err);
				return;
			}
		}

		// Attempt 2: strip markdown inline images
		try {
			persist(this.stripMarkdownImages(canvasData));
			markSaved();
			console.warn('localStorage quota: saved without markdown inline images (safe in cloud)');
			return;
		} catch {
			/* try next level */
		}

		// Attempt 3: strip all image data
		try {
			persist(this.stripAllImages(canvasData));
			markSaved();
			console.warn('localStorage quota: saved without any images (safe in cloud storage)');
			return;
		} catch {
			/* fall through */
		}

		this._isSaving = false;
		this.emitStateChange();
		console.error('localStorage completely full — canvas structure may be too large');
	}
}
