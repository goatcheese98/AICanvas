import type { CaptureScopeToggleProps } from './canvas-tour-layout-utils';

const CAPTURE_MODES: Array<{
	mode: 'full' | 'camera' | 'elements';
	label: string;
}> = [
	{ mode: 'full', label: 'Scene + camera' },
	{ mode: 'camera', label: 'Camera only' },
	{ mode: 'elements', label: 'Elements only' },
];

export function CaptureScopeToggle({
	registryCaptureMode,
	setRegistryCaptureMode,
}: CaptureScopeToggleProps) {
	return (
		<div className="canvas-tour-layout-section">
			<p className="canvas-tour-layout-section-title">Capture scope</p>
			<div className="canvas-tour-layout-mode-toggle" role="tablist" aria-label="Capture scope">
				{CAPTURE_MODES.map(({ mode, label }) => (
					<button
						type="button"
						key={mode}
						className={registryCaptureMode === mode ? 'canvas-tour-toggle-active' : ''}
						onClick={() => setRegistryCaptureMode(mode)}
					>
						{label}
					</button>
				))}
			</div>
			<p className="canvas-tour-layout-help">
				`Scene + camera` stores layout and zoom. `Camera only` updates framing for the selected
				scene. `Elements only` keeps the saved presentation framing intact.
			</p>
		</div>
	);
}
