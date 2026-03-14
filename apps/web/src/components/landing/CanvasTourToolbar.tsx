import type { ReactNode } from 'react';
import type { TourTool } from './useCanvasTourSceneController';

function ToolbarSvg({
	children,
	viewBox = '0 0 24 24',
}: {
	children: ReactNode;
	viewBox?: string;
}) {
	return (
		<svg aria-hidden="true" focusable="false" viewBox={viewBox} fill="none">
			{children}
		</svg>
	);
}

function ToolbarIcon({ tool }: { tool: TourTool }) {
	switch (tool) {
		case 'hand':
			return (
				<ToolbarSvg>
					<g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
						<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />
						<path d="M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5" />
						<path d="M14 5.5a1.5 1.5 0 0 1 3 0V12" />
						<path d="M17 7.5a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.01-2.7L3.7 13.6a1.5 1.5 0 0 1 .53-2.02a1.87 1.87 0 0 1 2.28.28L8 13Z" />
					</g>
				</ToolbarSvg>
			);
		case 'selection':
			return (
				<ToolbarSvg viewBox="0 0 22 22">
					<g stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
						<path d="M6 6l4.2 11.8c.1.2.2.2.3.2s.2 0 .3-.2l2.2-4.8 4.8-2c.1 0 .2-.1.2-.3s-.1-.2-.2-.3L6 6Z" />
						<path d="M13.5 13.5 18 18" />
					</g>
				</ToolbarSvg>
			);
		case 'rectangle':
			return (
				<ToolbarSvg>
					<rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
				</ToolbarSvg>
			);
		case 'diamond':
			return (
				<ToolbarSvg>
					<path
						d="M10.5 20.4 3.6 13.5a2.1 2.1 0 0 1 0-3l6.9-6.9a2.1 2.1 0 0 1 3 0l6.9 6.9a2.1 2.1 0 0 1 0 3l-6.9 6.9a2.1 2.1 0 0 1-3 0Z"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
				</ToolbarSvg>
			);
		case 'ellipse':
			return (
				<ToolbarSvg>
					<circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
				</ToolbarSvg>
			);
		case 'arrow':
			return (
				<ToolbarSvg>
					<g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
						<line x1="5" y1="12" x2="19" y2="12" />
						<line x1="15" y1="8" x2="19" y2="12" />
						<line x1="15" y1="16" x2="19" y2="12" />
					</g>
				</ToolbarSvg>
			);
		case 'line':
			return (
				<ToolbarSvg viewBox="0 0 20 20">
					<path d="M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
				</ToolbarSvg>
			);
		case 'freedraw':
			return (
				<ToolbarSvg viewBox="0 0 20 20">
					<g stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
						<path d="m7.6 15.7 7.8-7.8a2.35 2.35 0 1 0-3.3-3.3l-7.8 7.7a3.33 3.33 0 0 0-1 2.4v2h2c.9 0 1.7-.4 2.3-1Z" />
						<path d="m11.2 5.4 3.4 3.4" />
					</g>
				</ToolbarSvg>
			);
		case 'text':
			return (
				<ToolbarSvg>
					<g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
						<line x1="6" y1="5" x2="18" y2="5" />
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="8.5" y1="19" x2="15.5" y2="19" />
					</g>
				</ToolbarSvg>
			);
		case 'image':
			return (
				<ToolbarSvg viewBox="0 0 20 20">
					<g stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
						<rect x="2.6" y="2.6" width="14.8" height="14.8" rx="2.3" />
						<path d="M12.5 6.7h.01" />
						<path d="m3.8 12.5 3.1-3.1c.7-.7 1.6-.7 2.3 0l3.7 3.7" />
						<path d="m11.8 11.7.7-.7c.7-.7 1.6-.7 2.3 0l1.4 1.4" />
					</g>
				</ToolbarSvg>
			);
		case 'eraser':
			return (
				<ToolbarSvg>
					<g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
						<path d="M19 20H8.5l-4.2-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4L11.5 20" />
						<path d="m18 13.3-6.3-6.3" />
					</g>
				</ToolbarSvg>
			);
	}
}

const TOUR_TOOLS: Array<{ type: TourTool; label: string }> = [
	{ type: 'hand', label: 'Hand' },
	{ type: 'selection', label: 'Selection' },
	{ type: 'rectangle', label: 'Rectangle' },
	{ type: 'diamond', label: 'Diamond' },
	{ type: 'ellipse', label: 'Ellipse' },
	{ type: 'arrow', label: 'Arrow' },
	{ type: 'line', label: 'Line' },
	{ type: 'freedraw', label: 'Draw' },
	{ type: 'text', label: 'Text' },
	{ type: 'image', label: 'Image' },
	{ type: 'eraser', label: 'Eraser' },
];

interface CanvasTourToolbarProps {
	activeTool: TourTool;
	isGuideMode: boolean;
	onSelectTool: (tool: TourTool) => void;
}

export function CanvasTourToolbar({
	activeTool,
	isGuideMode,
	onSelectTool,
}: CanvasTourToolbarProps) {
	return (
		<div
			className={`canvas-tour-toolbar ${isGuideMode ? 'canvas-tour-toolbar-disabled' : ''}`}
			aria-label="Canvas tools"
			aria-disabled={isGuideMode}
		>
			<div className="canvas-tour-toolbar-group">
				{TOUR_TOOLS.map((tool) => (
					<button
						key={tool.type}
						type="button"
						className={`canvas-tour-toolbar-button ${
							activeTool === tool.type ? 'canvas-tour-toolbar-button-active' : ''
						}`}
						aria-label={tool.label}
						title={isGuideMode ? `${tool.label} (disabled in guide mode)` : tool.label}
						onClick={() => onSelectTool(tool.type)}
						disabled={isGuideMode}
					>
						<ToolbarIcon tool={tool.type} />
					</button>
				))}
			</div>
		</div>
	);
}
