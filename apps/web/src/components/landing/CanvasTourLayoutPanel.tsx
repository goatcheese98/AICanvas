import { forwardRef } from 'react';
import type { CanvasTourChapter, CanvasTourGuideOverlay } from './canvas-tour-content';
import type { RegisteredTourSceneSnapshot } from './canvas-tour-registry';
import type { CameraTarget } from './useCanvasTourSceneController';

interface CanvasTourLayoutPanelProps {
	canvasTourChapters: readonly CanvasTourChapter[];
	devCaptureStatus: string | null;
	liveCamera: CameraTarget;
	overlayDraft: CanvasTourGuideOverlay;
	overlayPlacementBounds: {
		leftMinRem: number;
		leftMaxRem: number;
		topMinRem: number;
		topMaxRem: number;
		widthMinRem: number;
		widthMaxRem: number;
	};
	overlayPlacementMeta: {
		guideWidthRem: number;
		guideHeightRem: number;
		editorWidthRem: number;
		editorHeightRem: number;
		panelAwarePreview: boolean;
		previewShiftXRem: number;
		previewShiftYRem: number;
	};
	registryCaptureMode: 'full' | 'camera' | 'elements';
	registrySceneId: string;
	selectedRegisteredScene: RegisteredTourSceneSnapshot | null;
	selectedRegistryChapter: CanvasTourChapter;
	setRegistryCaptureMode: (mode: 'full' | 'camera' | 'elements') => void;
	setRegistrySceneId: (sceneId: string) => void;
	updateOverlayDraft: (
		patch: Partial<Omit<CanvasTourGuideOverlay, 'placement'>> & {
			placement?: Partial<CanvasTourGuideOverlay['placement']>;
		},
	) => void;
	updateOverlayPlacement: (
		key: keyof CanvasTourGuideOverlay['placement'],
		value: number,
	) => void;
	nudgeOverlayPlacement: (
		key: keyof Pick<CanvasTourGuideOverlay['placement'], 'leftRem' | 'topRem'>,
		delta: number,
	) => void;
	applyOverlayPreset: (
		preset: 'top-left' | 'top-center' | 'top-right' | 'bottom-left',
	) => void;
	applyOverlayDraft: () => void;
	saveOverlayDraft: () => void;
	registerCurrentLayout: () => void;
	restoreRegisteredLayout: () => void;
	copyRegisteredLayout: () => void;
	clearRegisteredLayout: () => void;
}

export const CanvasTourLayoutPanel = forwardRef<HTMLDivElement, CanvasTourLayoutPanelProps>(function CanvasTourLayoutPanel({
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
}, ref) {
	return (
		<div ref={ref} className="canvas-tour-layout-panel">
			<div className="canvas-tour-layout-panel-header">
				<p className="canvas-tour-layout-panel-kicker">Layout tools</p>
				<p className="canvas-tour-layout-panel-copy">
					Scene-aware registry for presentation framing, guide stops, and future overlay authoring.
				</p>
			</div>

			<div className="canvas-tour-layout-section">
				<label className="canvas-tour-layout-field">
					<span>Target scene</span>
					<select value={registrySceneId} onChange={(event) => setRegistrySceneId(event.target.value)}>
						{canvasTourChapters.map((chapter) => (
							<option key={chapter.id} value={chapter.id}>
								{chapter.label} · {chapter.title}
							</option>
						))}
					</select>
				</label>
				<div className="canvas-tour-layout-stats">
					<div className="canvas-tour-layout-stat">
						<span>Live zoom</span>
						<strong>{liveCamera.zoom.toFixed(2)}x</strong>
					</div>
					<div className="canvas-tour-layout-stat">
						<span>Live center</span>
						<strong>{`${Math.round(liveCamera.x)}, ${Math.round(liveCamera.y)}`}</strong>
					</div>
					<div className="canvas-tour-layout-stat">
						<span>Saved zoom</span>
						<strong>
							{selectedRegisteredScene
								? `${selectedRegisteredScene.camera.zoom.toFixed(2)}x`
								: 'Default'}
						</strong>
					</div>
					<div className="canvas-tour-layout-stat">
						<span>Saved at</span>
						<strong>
							{selectedRegisteredScene
								? new Date(selectedRegisteredScene.capturedAt).toLocaleTimeString()
								: 'Not saved'}
						</strong>
					</div>
				</div>
			</div>

			<div className="canvas-tour-layout-section">
				<p className="canvas-tour-layout-section-title">Capture scope</p>
				<div className="canvas-tour-layout-mode-toggle" role="tablist" aria-label="Capture scope">
					<button
						type="button"
						className={registryCaptureMode === 'full' ? 'canvas-tour-toggle-active' : ''}
						onClick={() => setRegistryCaptureMode('full')}
					>
						Scene + camera
					</button>
					<button
						type="button"
						className={registryCaptureMode === 'camera' ? 'canvas-tour-toggle-active' : ''}
						onClick={() => setRegistryCaptureMode('camera')}
					>
						Camera only
					</button>
					<button
						type="button"
						className={registryCaptureMode === 'elements' ? 'canvas-tour-toggle-active' : ''}
						onClick={() => setRegistryCaptureMode('elements')}
					>
						Elements only
					</button>
				</div>
				<p className="canvas-tour-layout-help">
					`Scene + camera` stores layout and zoom. `Camera only` updates framing for the selected
					scene. `Elements only` keeps the saved presentation framing intact.
				</p>
			</div>

			<div className="canvas-tour-layout-section">
				<p className="canvas-tour-layout-section-title">Guide overlay editor</p>
				<div className="canvas-tour-layout-editor">
					<div className="canvas-tour-layout-form">
						<label className="canvas-tour-layout-field">
							<span>Overlay label</span>
							<input
								type="text"
								value={overlayDraft.label}
								onChange={(event) => updateOverlayDraft({ label: event.target.value })}
							/>
						</label>
						<label className="canvas-tour-layout-field">
							<span>Overlay title</span>
							<textarea
								rows={2}
								value={overlayDraft.title}
								onChange={(event) => updateOverlayDraft({ title: event.target.value })}
							/>
						</label>
						<label className="canvas-tour-layout-field">
							<span>Overlay description</span>
							<textarea
								rows={4}
								value={overlayDraft.description}
								onChange={(event) => updateOverlayDraft({ description: event.target.value })}
							/>
						</label>
						<label className="canvas-tour-layout-field">
							<span>Overlay hint</span>
							<input
								type="text"
								value={overlayDraft.hint}
								onChange={(event) => updateOverlayDraft({ hint: event.target.value })}
							/>
						</label>
					</div>
					<div className="canvas-tour-layout-control-column">
						<div className="canvas-tour-layout-placement-header">
							<p className="canvas-tour-layout-section-title">Overlay placement</p>
							<p className="canvas-tour-layout-help">
								Guide placement uses the full presentation viewport. Preview stays inside an
								editor-safe area when layout tools are open.
							</p>
							<div className="canvas-tour-layout-preset-grid">
								<button type="button" className="canvas-tour-reset" onClick={() => applyOverlayPreset('top-left')}>
									Top left
								</button>
								<button type="button" className="canvas-tour-reset" onClick={() => applyOverlayPreset('top-center')}>
									Top center
								</button>
								<button type="button" className="canvas-tour-reset" onClick={() => applyOverlayPreset('top-right')}>
									Top right
								</button>
								<button type="button" className="canvas-tour-reset" onClick={() => applyOverlayPreset('bottom-left')}>
									Bottom left
								</button>
							</div>
						</div>
						<div className="canvas-tour-layout-nudge">
							<button type="button" className="canvas-tour-reset" onClick={() => nudgeOverlayPlacement('leftRem', -0.5)}>
								Left
							</button>
							<button type="button" className="canvas-tour-reset" onClick={() => nudgeOverlayPlacement('topRem', -0.5)}>
								Up
							</button>
							<button type="button" className="canvas-tour-reset" onClick={() => nudgeOverlayPlacement('topRem', 0.5)}>
								Down
							</button>
							<button type="button" className="canvas-tour-reset" onClick={() => nudgeOverlayPlacement('leftRem', 0.5)}>
								Right
							</button>
						</div>
						<div className="canvas-tour-layout-stats canvas-tour-layout-stats-compact">
							<div className="canvas-tour-layout-stat">
								<span>Guide safe area</span>
								<strong>{`${overlayPlacementMeta.guideWidthRem.toFixed(1)}rem x ${overlayPlacementMeta.guideHeightRem.toFixed(1)}rem`}</strong>
							</div>
							<div className="canvas-tour-layout-stat">
								<span>Editor safe area</span>
								<strong>{`${overlayPlacementMeta.editorWidthRem.toFixed(1)}rem x ${overlayPlacementMeta.editorHeightRem.toFixed(1)}rem`}</strong>
							</div>
							<div className="canvas-tour-layout-stat">
								<span>Preview shift</span>
								<strong>
									{overlayPlacementMeta.panelAwarePreview
										? `${overlayPlacementMeta.previewShiftXRem.toFixed(1)}rem, ${overlayPlacementMeta.previewShiftYRem.toFixed(1)}rem`
										: 'None'}
								</strong>
							</div>
						</div>
						<div className="canvas-tour-layout-overlay-grid">
							<label className="canvas-tour-layout-field">
								<span>Left</span>
								<input
									className="canvas-tour-layout-range"
									type="range"
									min={overlayPlacementBounds.leftMinRem}
									max={overlayPlacementBounds.leftMaxRem}
									step="0.1"
									value={overlayDraft.placement.leftRem}
									onChange={(event) => updateOverlayPlacement('leftRem', Number(event.target.value))}
								/>
								<input
									type="number"
									step="0.1"
									value={overlayDraft.placement.leftRem}
									onChange={(event) => updateOverlayPlacement('leftRem', Number(event.target.value))}
								/>
							</label>
							<label className="canvas-tour-layout-field">
								<span>Top</span>
								<input
									className="canvas-tour-layout-range"
									type="range"
									min={overlayPlacementBounds.topMinRem}
									max={overlayPlacementBounds.topMaxRem}
									step="0.1"
									value={overlayDraft.placement.topRem}
									onChange={(event) => updateOverlayPlacement('topRem', Number(event.target.value))}
								/>
								<input
									type="number"
									step="0.1"
									value={overlayDraft.placement.topRem}
									onChange={(event) => updateOverlayPlacement('topRem', Number(event.target.value))}
								/>
							</label>
							<label className="canvas-tour-layout-field">
								<span>Width</span>
								<input
									className="canvas-tour-layout-range"
									type="range"
									min={overlayPlacementBounds.widthMinRem}
									max={overlayPlacementBounds.widthMaxRem}
									step="0.1"
									value={overlayDraft.placement.widthRem}
									onChange={(event) => updateOverlayPlacement('widthRem', Number(event.target.value))}
								/>
								<input
									type="number"
									step="0.1"
									value={overlayDraft.placement.widthRem}
									onChange={(event) => updateOverlayPlacement('widthRem', Number(event.target.value))}
								/>
							</label>
							<label className="canvas-tour-layout-field">
								<span>Surface opacity</span>
								<input
									className="canvas-tour-layout-range"
									type="range"
									min="0.55"
									max="1"
									step="0.01"
									value={overlayDraft.surfaceOpacity}
									onChange={(event) =>
										updateOverlayDraft({ surfaceOpacity: Number(event.target.value) })
									}
								/>
								<input
									type="number"
									min="0.55"
									max="1"
									step="0.01"
									value={overlayDraft.surfaceOpacity}
									onChange={(event) =>
										updateOverlayDraft({ surfaceOpacity: Number(event.target.value) })
									}
								/>
							</label>
							<label className="canvas-tour-layout-field">
								<span>Accent</span>
								<input
									type="color"
									value={overlayDraft.accentColor}
									onChange={(event) => updateOverlayDraft({ accentColor: event.target.value })}
								/>
							</label>
						</div>
					</div>
				</div>
				<div className="canvas-tour-layout-actions">
					<button type="button" className="canvas-tour-reset" onClick={applyOverlayDraft}>
						Preview overlay
					</button>
					<button type="button" className="canvas-tour-reset" onClick={saveOverlayDraft}>
						Save overlay
					</button>
				</div>
			</div>

			<div className="canvas-tour-layout-section">
				<p className="canvas-tour-layout-section-title">Scene actions</p>
				<div className="canvas-tour-layout-actions">
					<button type="button" className="canvas-tour-reset" onClick={registerCurrentLayout}>
						Register selected scene
					</button>
					<button type="button" className="canvas-tour-reset" onClick={restoreRegisteredLayout}>
						Load selected scene
					</button>
					<button type="button" className="canvas-tour-reset" onClick={copyRegisteredLayout}>
						Copy selected JSON
					</button>
					<button type="button" className="canvas-tour-reset" onClick={clearRegisteredLayout}>
						Clear selected scene
					</button>
				</div>
				<p className="canvas-tour-layout-meta">
					Editing target: <strong>{selectedRegistryChapter.title}</strong>
				</p>
			</div>

			{devCaptureStatus ? <p className="canvas-tour-layout-status">{devCaptureStatus}</p> : null}
		</div>
	);
});
