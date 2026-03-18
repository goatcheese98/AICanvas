import { forwardRef } from 'react';
import { CaptureScopeToggle } from './CaptureScopeToggle';
import { CaptureStatus } from './CaptureStatus';
import { LayoutPanelHeader } from './LayoutPanelHeader';
import { OverlayEditor } from './OverlayEditor';
import { SceneActions } from './SceneActions';
import { SceneSelector } from './SceneSelector';
import type { CanvasTourLayoutPanelProps } from './canvas-tour-layout-utils';

export { type CanvasTourLayoutPanelProps } from './canvas-tour-layout-utils';

export const CanvasTourLayoutPanel = forwardRef<HTMLDivElement, CanvasTourLayoutPanelProps>(
	function CanvasTourLayoutPanel(
		{
			canvasTourChapters,
			devCaptureStatus,
			liveCamera,
			overlayDraft,
			overlayPlacementBounds,
			overlayPlacementMeta,
			registryCaptureMode,
			registrySceneId,
			selectedRegisteredScene,
			selectedRegistryChapter,
			setRegistryCaptureMode,
			setRegistrySceneId,
			updateOverlayDraft,
			updateOverlayPlacement,
			nudgeOverlayPlacement,
			applyOverlayPreset,
			applyOverlayDraft,
			saveOverlayDraft,
			registerCurrentLayout,
			restoreRegisteredLayout,
			copyRegisteredLayout,
			clearRegisteredLayout,
		},
		ref,
	) {
		return (
			<div ref={ref} className="canvas-tour-layout-panel">
				<LayoutPanelHeader copy="Scene-aware registry for presentation framing, guide stops, and future overlay authoring." />

				<SceneSelector
					registrySceneId={registrySceneId}
					canvasTourChapters={canvasTourChapters}
					liveCamera={liveCamera}
					selectedRegisteredScene={selectedRegisteredScene}
					setRegistrySceneId={setRegistrySceneId}
				/>

				<CaptureScopeToggle
					registryCaptureMode={registryCaptureMode}
					setRegistryCaptureMode={setRegistryCaptureMode}
				/>

				<OverlayEditor
					overlayDraft={overlayDraft}
					overlayPlacementBounds={overlayPlacementBounds}
					overlayPlacementMeta={overlayPlacementMeta}
					updateOverlayDraft={updateOverlayDraft}
					updateOverlayPlacement={updateOverlayPlacement}
					nudgeOverlayPlacement={nudgeOverlayPlacement}
					applyOverlayPreset={applyOverlayPreset}
					applyOverlayDraft={applyOverlayDraft}
					saveOverlayDraft={saveOverlayDraft}
				/>

				<SceneActions
					selectedRegistryChapter={selectedRegistryChapter}
					registerCurrentLayout={registerCurrentLayout}
					restoreRegisteredLayout={restoreRegisteredLayout}
					copyRegisteredLayout={copyRegisteredLayout}
					clearRegisteredLayout={clearRegisteredLayout}
				/>

				<CaptureStatus devCaptureStatus={devCaptureStatus} />
			</div>
		);
	},
);
