import type { CanvasTourChapter } from './canvas-tour-content';
import {
	formatCameraCoordinates,
	formatCapturedTime,
	formatZoom,
	getSavedZoomLabel,
} from './canvas-tour-layout-utils';
import type { SceneSelectorProps } from './canvas-tour-layout-utils';

export function SceneSelector({
	registrySceneId,
	canvasTourChapters,
	liveCamera,
	selectedRegisteredScene,
	setRegistrySceneId,
}: SceneSelectorProps) {
	return (
		<div className="canvas-tour-layout-section">
			<label className="canvas-tour-layout-field">
				<span>Target scene</span>
				<select
					value={registrySceneId}
					onChange={(event) => setRegistrySceneId(event.target.value)}
				>
					{canvasTourChapters.map((chapter: CanvasTourChapter) => (
						<option key={chapter.id} value={chapter.id}>
							{chapter.label} · {chapter.title}
						</option>
					))}
				</select>
			</label>
			<div className="canvas-tour-layout-stats">
				<div className="canvas-tour-layout-stat">
					<span>Live zoom</span>
					<strong>{formatZoom(liveCamera.zoom)}</strong>
				</div>
				<div className="canvas-tour-layout-stat">
					<span>Live center</span>
					<strong>
						{formatCameraCoordinates(liveCamera.x, liveCamera.y)}
					</strong>
				</div>
				<div className="canvas-tour-layout-stat">
					<span>Saved zoom</span>
					<strong>{getSavedZoomLabel(selectedRegisteredScene)}</strong>
				</div>
				<div className="canvas-tour-layout-stat">
					<span>Saved at</span>
					<strong>
						{formatCapturedTime(selectedRegisteredScene?.capturedAt ?? null)}
					</strong>
				</div>
			</div>
		</div>
	);
}
