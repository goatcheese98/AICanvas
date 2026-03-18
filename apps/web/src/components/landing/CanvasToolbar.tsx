import { ToolbarIcon } from './landing-canvas-scene-utils';

export function CanvasToolbar() {
	return (
		<div className="landing-toolbar" aria-hidden="true">
			<div className="landing-toolbar-hint">
				<span>Scroll to pan the story</span>
			</div>
			<div className="landing-toolbar-group">
				<div className="landing-toolbar-button landing-toolbar-button-lock">
					<ToolbarIcon viewBox="0 0 20 20">
						<path
							d="M13.542 8.542H6.458a2.5 2.5 0 0 0-2.5 2.5v3.75a2.5 2.5 0 0 0 2.5 2.5h7.084a2.5 2.5 0 0 0 2.5-2.5v-3.75a2.5 2.5 0 0 0-2.5-2.5Z"
							strokeWidth="1.25"
						/>
						<path
							d="M10 13.958a1.042 1.042 0 1 0 0-2.083 1.042 1.042 0 0 0 0 2.083Z"
							strokeWidth="1.25"
						/>
						<path
							d="M6.4 9.56V5.18c0-.93.4-1.83 1.11-2.49A3.98 3.98 0 0 1 10.21 1.67c1.01 0 1.98.37 2.69 1.03.72.66 1.12 1.55 1.12 2.48"
							strokeWidth="1.25"
						/>
					</ToolbarIcon>
				</div>
			</div>
			<span className="landing-toolbar-divider" />
			<div className="landing-toolbar-group">
				<div className="landing-toolbar-button landing-toolbar-button-active">
					<ToolbarIcon viewBox="0 0 22 22">
						<g strokeWidth="1.25">
							<path d="M6 6l4.153 11.793a0.365 0.365 0 0 0 .331.207a0.366 0.366 0 0 0 .332-.207L13 13l4.787-1.994a0.355 0.355 0 0 0 .213-.323a0.355 0.355 0 0 0-.213-.323L6 6Z" />
							<path d="M13.5 13.5 18 18" />
						</g>
					</ToolbarIcon>
					<span className="landing-toolbar-key">1</span>
				</div>
				<div className="landing-toolbar-button">
					<ToolbarIcon>
						<rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="1.5" />
					</ToolbarIcon>
					<span className="landing-toolbar-key">2</span>
				</div>
				<div className="landing-toolbar-button">
					<ToolbarIcon>
						<path
							d="M10.5 20.4 3.6 13.5c-.78-.78-.78-2.22 0-3l6.9-6.9c.78-.78 2.22-.78 3 0l6.9 6.9c.78.78.78 2.22 0 3l-6.9 6.9c-.78.78-2.22.78-3 0Z"
							strokeWidth="1.5"
						/>
					</ToolbarIcon>
					<span className="landing-toolbar-key">3</span>
				</div>
				<div className="landing-toolbar-button">
					<ToolbarIcon>
						<circle cx="12" cy="12" r="9" strokeWidth="1.5" />
					</ToolbarIcon>
					<span className="landing-toolbar-key">4</span>
				</div>
				<div className="landing-toolbar-button">
					<ToolbarIcon>
						<line x1="5" y1="12" x2="19" y2="12" strokeWidth="1.5" />
						<line x1="15" y1="16" x2="19" y2="12" strokeWidth="1.5" />
						<line x1="15" y1="8" x2="19" y2="12" strokeWidth="1.5" />
					</ToolbarIcon>
					<span className="landing-toolbar-key">5</span>
				</div>
			</div>
			<span className="landing-toolbar-divider" />
			<div className="landing-toolbar-group">
				<div className="landing-toolbar-button">
					<ToolbarIcon viewBox="0 0 20 20">
						<g strokeWidth="1.25">
							<path d="M12.5 6.667h.01" />
							<path d="M4.91 2.625h10.18a2.284 2.284 0 0 1 2.285 2.284v10.182a2.284 2.284 0 0 1-2.284 2.284H4.909a2.284 2.284 0 0 1-2.284-2.284V4.909a2.284 2.284 0 0 1 2.284-2.284Z" />
							<path d="m3.333 12.5 3.334-3.333c.773-.745 1.726-.745 2.5 0l4.166 4.166" />
						</g>
					</ToolbarIcon>
					<span className="landing-toolbar-key">6</span>
				</div>
				<div className="landing-toolbar-button">
					<ToolbarIcon viewBox="0 0 20 20">
						<g strokeWidth="1.25">
							<path d="m7.643 15.69 7.774-7.773a2.357 2.357 0 1 0-3.334-3.334L4.31 12.357a3.333 3.333 0 0 0-.977 2.357v1.953h1.953c.884 0 1.732-.352 2.357-.977Z" />
							<path d="m11.25 5.417 3.333 3.333" />
						</g>
					</ToolbarIcon>
					<span className="landing-toolbar-key">7</span>
				</div>
				<div className="landing-toolbar-button">
					<ToolbarIcon>
						<g strokeWidth="1.5">
							<path d="M12 3 8 10h8Z" />
							<circle cx="17" cy="17" r="3" />
							<rect x="4" y="14" width="6" height="6" rx="1" />
						</g>
					</ToolbarIcon>
					<span className="landing-toolbar-key">8</span>
				</div>
			</div>
		</div>
	);
}
