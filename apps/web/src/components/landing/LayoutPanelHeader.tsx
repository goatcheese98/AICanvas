import type { LayoutPanelHeaderProps } from './canvas-tour-layout-utils';

export function LayoutPanelHeader({ kicker = 'Layout tools', copy }: LayoutPanelHeaderProps) {
	return (
		<div className="canvas-tour-layout-panel-header">
			<p className="canvas-tour-layout-panel-kicker">{kicker}</p>
			<p className="canvas-tour-layout-panel-copy">{copy}</p>
		</div>
	);
}
