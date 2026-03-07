// Excalidraw-specific types are aliased here as opaque types so shared
// does not need @excalidraw/excalidraw as a dependency. The web app imports
// concrete Excalidraw types directly where it needs them.
export type CanvasElement = Record<string, unknown>;
export type CanvasAppState = Record<string, unknown>;
export type CanvasFiles = Record<string, unknown>;

export interface Canvas {
	id: string;
	userId: string;
	title: string;
	description?: string;
	isPublic: boolean;
	r2Key: string;
	thumbnailUrl?: string;
	isFavorite: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CanvasSavePayload {
	elements: readonly CanvasElement[];
	appState: CanvasAppState;
	files: CanvasFiles;
}
