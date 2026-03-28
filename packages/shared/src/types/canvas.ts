// Excalidraw-specific types are aliased here as opaque types so shared
// does not need @excalidraw/excalidraw as a dependency. The web app imports
// concrete Excalidraw types directly where it needs them.
import type {
	KanbanOverlayCustomData,
	NewLexOverlayCustomData,
	PrototypeOverlayCustomData,
} from './overlay';

export type CanvasElement = Record<string, unknown>;
export type CanvasAppState = Record<string, unknown>;
export type CanvasFiles = Record<string, unknown>;

export type HeavyResourceType = 'board' | 'document' | 'prototype';

export interface CanvasHeavyResourceReference {
	resourceType: HeavyResourceType;
	resourceId: string;
	title: string;
}

export interface CanvasResourceSnapshotDisplay {
	subtitle?: string;
	summary?: string;
	badge?: string;
}

export interface CanvasResourceSnapshot extends CanvasHeavyResourceReference {
	snapshotVersion: number;
	display: CanvasResourceSnapshotDisplay;
}

export interface HeavyResourceRecordBase {
	id: string;
	canvasId: string;
	resourceType: HeavyResourceType;
	title: string;
	createdAt: string;
	updatedAt: string;
}

export interface BoardResourceRecord extends HeavyResourceRecordBase {
	resourceType: 'board';
	data: KanbanOverlayCustomData;
}

export interface DocumentResourceRecord extends HeavyResourceRecordBase {
	resourceType: 'document';
	data: NewLexOverlayCustomData;
}

export interface PrototypeResourceRecord extends HeavyResourceRecordBase {
	resourceType: 'prototype';
	data: PrototypeOverlayCustomData;
}

export type HeavyResourceRecord =
	| BoardResourceRecord
	| DocumentResourceRecord
	| PrototypeResourceRecord;

export interface Canvas {
	id: string;
	userId: string;
	title: string;
	description?: string;
	isPublic: boolean;
	r2Key: string;
	thumbnailUrl?: string;
	isFavorite: boolean;
	version?: number;
	createdAt: string;
	updatedAt: string;
}

export interface CanvasSavePayload {
	elements: readonly CanvasElement[];
	appState: CanvasAppState;
	files: CanvasFiles;
}

export interface SaveCanvasRequest extends CanvasSavePayload {
	expectedVersion: number;
}
