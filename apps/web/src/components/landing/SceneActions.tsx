import type { SceneActionsProps } from './canvas-tour-layout-utils';

export function SceneActions({
	selectedRegistryChapter,
	registerCurrentLayout,
	restoreRegisteredLayout,
	copyRegisteredLayout,
	clearRegisteredLayout,
}: SceneActionsProps) {
	return (
		<div className="canvas-tour-layout-section">
			<p className="canvas-tour-layout-section-title">Scene actions</p>
			<div className="canvas-tour-layout-actions">
				<button
					type="button"
					className="canvas-tour-reset"
					onClick={registerCurrentLayout}
				>
					Register selected scene
				</button>
				<button
					type="button"
					className="canvas-tour-reset"
					onClick={restoreRegisteredLayout}
				>
					Load selected scene
				</button>
				<button
					type="button"
					className="canvas-tour-reset"
					onClick={copyRegisteredLayout}
				>
					Copy selected JSON
				</button>
				<button
					type="button"
					className="canvas-tour-reset"
					onClick={clearRegisteredLayout}
				>
					Clear selected scene
				</button>
			</div>
			<p className="canvas-tour-layout-meta">
				Editing target: <strong>{selectedRegistryChapter.title}</strong>
			</p>
		</div>
	);
}
