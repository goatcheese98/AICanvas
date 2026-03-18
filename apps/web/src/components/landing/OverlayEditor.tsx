import type { CanvasTourGuideOverlay } from './canvas-tour-content';
import {
	formatDimensions,
	formatPreviewShift,
} from './canvas-tour-layout-utils';
import type { OverlayEditorProps } from './canvas-tour-layout-utils';

const OVERLAY_PRESETS: Array<{
	preset: 'top-left' | 'top-center' | 'top-right' | 'bottom-left';
	label: string;
}> = [
	{ preset: 'top-left', label: 'Top left' },
	{ preset: 'top-center', label: 'Top center' },
	{ preset: 'top-right', label: 'Top right' },
	{ preset: 'bottom-left', label: 'Bottom left' },
];

export function OverlayEditor({
	overlayDraft,
	overlayPlacementBounds,
	overlayPlacementMeta,
	updateOverlayDraft,
	updateOverlayPlacement,
	nudgeOverlayPlacement,
	applyOverlayPreset,
	applyOverlayDraft,
	saveOverlayDraft,
}: OverlayEditorProps) {
	return (
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
							onChange={(event) =>
								updateOverlayDraft({ description: event.target.value })
							}
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
					<OverlayPlacementControls
						overlayDraft={overlayDraft}
						overlayPlacementBounds={overlayPlacementBounds}
						overlayPlacementMeta={overlayPlacementMeta}
						updateOverlayPlacement={updateOverlayPlacement}
						nudgeOverlayPlacement={nudgeOverlayPlacement}
						applyOverlayPreset={applyOverlayPreset}
						updateOverlayDraft={updateOverlayDraft}
					/>
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
	);
}

interface OverlayPlacementControlsProps
	extends Pick<
		OverlayEditorProps,
		| 'overlayDraft'
		| 'overlayPlacementBounds'
		| 'overlayPlacementMeta'
		| 'updateOverlayPlacement'
		| 'nudgeOverlayPlacement'
		| 'applyOverlayPreset'
		| 'updateOverlayDraft'
	> {}

function OverlayPlacementControls({
	overlayDraft,
	overlayPlacementBounds,
	overlayPlacementMeta,
	updateOverlayPlacement,
	nudgeOverlayPlacement,
	applyOverlayPreset,
	updateOverlayDraft,
}: OverlayPlacementControlsProps) {
	return (
		<>
			<div className="canvas-tour-layout-placement-header">
				<p className="canvas-tour-layout-section-title">Overlay placement</p>
				<p className="canvas-tour-layout-help">
					Guide placement uses the full presentation viewport. Preview stays inside an
					editor-safe area when layout tools are open.
				</p>
				<div className="canvas-tour-layout-preset-grid">
					{OVERLAY_PRESETS.map(({ preset, label }) => (
						<button
							type="button"
							key={preset}
							className="canvas-tour-reset"
							onClick={() => applyOverlayPreset(preset)}
						>
							{label}
						</button>
					))}
				</div>
			</div>
			<div className="canvas-tour-layout-nudge">
				<button
					type="button"
					className="canvas-tour-reset"
					onClick={() => nudgeOverlayPlacement('leftRem', -0.5)}
				>
					Left
				</button>
				<button
					type="button"
					className="canvas-tour-reset"
					onClick={() => nudgeOverlayPlacement('topRem', -0.5)}
				>
					Up
				</button>
				<button
					type="button"
					className="canvas-tour-reset"
					onClick={() => nudgeOverlayPlacement('topRem', 0.5)}
				>
					Down
				</button>
				<button
					type="button"
					className="canvas-tour-reset"
					onClick={() => nudgeOverlayPlacement('leftRem', 0.5)}
				>
					Right
				</button>
			</div>
			<div className="canvas-tour-layout-stats canvas-tour-layout-stats-compact">
				<div className="canvas-tour-layout-stat">
					<span>Guide safe area</span>
					<strong>
						{formatDimensions(
							overlayPlacementMeta.guideWidthRem,
							overlayPlacementMeta.guideHeightRem,
						)}
					</strong>
				</div>
				<div className="canvas-tour-layout-stat">
					<span>Editor safe area</span>
					<strong>
						{formatDimensions(
							overlayPlacementMeta.editorWidthRem,
							overlayPlacementMeta.editorHeightRem,
						)}
					</strong>
				</div>
				<div className="canvas-tour-layout-stat">
					<span>Preview shift</span>
					<strong>
						{formatPreviewShift(
							overlayPlacementMeta.panelAwarePreview,
							overlayPlacementMeta.previewShiftXRem,
							overlayPlacementMeta.previewShiftYRem,
						)}
					</strong>
				</div>
			</div>
			<div className="canvas-tour-layout-overlay-grid">
				<PlacementField
					label="Left"
					placementKey="leftRem"
					value={overlayDraft.placement.leftRem}
					bounds={overlayPlacementBounds.leftMinRem}
					max={overlayPlacementBounds.leftMaxRem}
					onChange={updateOverlayPlacement}
				/>
				<PlacementField
					label="Top"
					placementKey="topRem"
					value={overlayDraft.placement.topRem}
					bounds={overlayPlacementBounds.topMinRem}
					max={overlayPlacementBounds.topMaxRem}
					onChange={updateOverlayPlacement}
				/>
				<PlacementField
					label="Width"
					placementKey="widthRem"
					value={overlayDraft.placement.widthRem}
					bounds={overlayPlacementBounds.widthMinRem}
					max={overlayPlacementBounds.widthMaxRem}
					onChange={updateOverlayPlacement}
				/>
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
						onChange={(event) =>
							updateOverlayDraft({ accentColor: event.target.value })
						}
					/>
				</label>
			</div>
		</>
	);
}

interface PlacementFieldProps {
	label: string;
	placementKey: keyof CanvasTourGuideOverlay['placement'];
	value: number;
	bounds: number;
	max: number;
	onChange: (key: keyof CanvasTourGuideOverlay['placement'], value: number) => void;
}

function PlacementField({
	label,
	placementKey,
	value,
	bounds,
	max,
	onChange,
}: PlacementFieldProps) {
	return (
		<label className="canvas-tour-layout-field">
			<span>{label}</span>
			<input
				className="canvas-tour-layout-range"
				type="range"
				min={bounds}
				max={max}
				step="0.1"
				value={value}
				onChange={(event) => onChange(placementKey, Number(event.target.value))}
			/>
			<input
				type="number"
				step="0.1"
				value={value}
				onChange={(event) => onChange(placementKey, Number(event.target.value))}
			/>
		</label>
	);
}
