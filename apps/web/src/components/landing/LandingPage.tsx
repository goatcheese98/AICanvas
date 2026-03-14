import { landingContent } from './landing-content';
import './landing.css';

function ToolbarIcon({ children, viewBox = '0 0 24 24' }: { children: React.ReactNode; viewBox?: string }) {
	return (
		<svg
			aria-hidden="true"
			className="landing-toolbar-svg"
			fill="none"
			focusable="false"
			role="img"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			viewBox={viewBox}
		>
			{children}
		</svg>
	);
}

export function LandingPage() {
	return (
		<div className="landing-page">
			<main id="top" className="landing-shell">
				<section className="landing-stage">
					<div className="landing-stage-bar">
						<div className="landing-stage-brand">
							<div className="landing-stage-dots" aria-hidden="true">
								<span />
								<span />
								<span />
							</div>
							<a className="landing-link landing-stage-wordmark" href="#top">
								{landingContent.brand.name}
							</a>
						</div>
					</div>

					<div className="landing-scene">
						<div className="landing-scene-board">
							<div className="landing-toolbar" aria-hidden="true">
								<div className="landing-toolbar-hint">
									<span>Hold space to pan</span>
								</div>
								<div className="landing-toolbar-group">
									<button className="landing-toolbar-button landing-toolbar-button-lock" type="button">
										<ToolbarIcon viewBox="0 0 20 20">
											<path d="M13.542 8.542H6.458a2.5 2.5 0 0 0-2.5 2.5v3.75a2.5 2.5 0 0 0 2.5 2.5h7.084a2.5 2.5 0 0 0 2.5-2.5v-3.75a2.5 2.5 0 0 0-2.5-2.5Z" strokeWidth="1.25" />
											<path d="M10 13.958a1.042 1.042 0 1 0 0-2.083 1.042 1.042 0 0 0 0 2.083Z" strokeWidth="1.25" />
											<path d="M6.4 9.56V5.18c0-.93.4-1.83 1.11-2.49A3.98 3.98 0 0 1 10.21 1.67c1.01 0 1.98.37 2.69 1.03.72.66 1.12 1.55 1.12 2.48" strokeWidth="1.25" />
										</ToolbarIcon>
									</button>
								</div>
								<span className="landing-toolbar-divider" />
								<div className="landing-toolbar-group">
									<button className="landing-toolbar-button" type="button">
										<ToolbarIcon>
											<g strokeWidth="1.25">
												<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />
												<path d="M11 5.5v-2a1.5 1.5 0 1 1 3 0V12" />
												<path d="M14 5.5a1.5 1.5 0 0 1 3 0V12" />
												<path d="M17 7.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.2-3l-3.1-5.5a1.5 1.5 0 0 1 .54-2.02a1.87 1.87 0 0 1 2.28.28L8 13" />
											</g>
										</ToolbarIcon>
									</button>
									<button className="landing-toolbar-button landing-toolbar-button-active" type="button">
										<ToolbarIcon viewBox="0 0 22 22">
											<g strokeWidth="1.25">
												<path d="M6 6l4.153 11.793a0.365 0.365 0 0 0 .331.207a0.366 0.366 0 0 0 .332-.207L13 13l4.787-1.994a0.355 0.355 0 0 0 .213-.323a0.355 0.355 0 0 0-.213-.323L6 6Z" />
												<path d="M13.5 13.5 18 18" />
											</g>
										</ToolbarIcon>
										<span className="landing-toolbar-key">1</span>
									</button>
									<button className="landing-toolbar-button" type="button">
										<ToolbarIcon>
											<rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="1.5" />
										</ToolbarIcon>
										<span className="landing-toolbar-key">2</span>
									</button>
									<button className="landing-toolbar-button" type="button">
										<ToolbarIcon>
											<path d="M10.5 20.4 3.6 13.5c-.78-.78-.78-2.22 0-3l6.9-6.9c.78-.78 2.22-.78 3 0l6.9 6.9c.78.78.78 2.22 0 3l-6.9 6.9c-.78.78-2.22.78-3 0Z" strokeWidth="1.5" />
										</ToolbarIcon>
										<span className="landing-toolbar-key">3</span>
									</button>
									<button className="landing-toolbar-button" type="button">
										<ToolbarIcon>
											<circle cx="12" cy="12" r="9" strokeWidth="1.5" />
										</ToolbarIcon>
										<span className="landing-toolbar-key">4</span>
									</button>
									<button className="landing-toolbar-button" type="button">
										<ToolbarIcon>
											<line x1="5" y1="12" x2="19" y2="12" strokeWidth="1.5" />
											<line x1="15" y1="16" x2="19" y2="12" strokeWidth="1.5" />
											<line x1="15" y1="8" x2="19" y2="12" strokeWidth="1.5" />
										</ToolbarIcon>
										<span className="landing-toolbar-key">5</span>
									</button>
									<button className="landing-toolbar-button" type="button">
										<ToolbarIcon viewBox="0 0 20 20">
											<path d="M4.167 10h11.666" strokeWidth="1.5" />
										</ToolbarIcon>
										<span className="landing-toolbar-key">6</span>
									</button>
									<button className="landing-toolbar-button" type="button">
										<ToolbarIcon viewBox="0 0 20 20">
											<g strokeWidth="1.25">
												<path d="m7.643 15.69 7.774-7.773a2.357 2.357 0 1 0-3.334-3.334L4.31 12.357a3.333 3.333 0 0 0-.977 2.357v1.953h1.953c.884 0 1.732-.352 2.357-.977Z" />
												<path d="m11.25 5.417 3.333 3.333" />
											</g>
										</ToolbarIcon>
										<span className="landing-toolbar-key">7</span>
									</button>
								</div>
								<span className="landing-toolbar-divider" />
								<div className="landing-toolbar-group">
									<button className="landing-toolbar-button" type="button">
										<ToolbarIcon>
											<g strokeWidth="1.5">
												<line x1="4" y1="20" x2="7" y2="20" />
												<line x1="14" y1="20" x2="21" y2="20" />
												<line x1="6.9" y1="15" x2="13.8" y2="15" />
												<line x1="10.2" y1="6.3" x2="16" y2="20" />
												<polyline points="5 20 11 4 13 4 20 20" />
											</g>
										</ToolbarIcon>
										<span className="landing-toolbar-key">8</span>
									</button>
									<button className="landing-toolbar-button" type="button">
										<ToolbarIcon viewBox="0 0 20 20">
											<g strokeWidth="1.25">
												<path d="M12.5 6.667h.01" />
												<path d="M4.91 2.625h10.18a2.284 2.284 0 0 1 2.285 2.284v10.182a2.284 2.284 0 0 1-2.284 2.284H4.909a2.284 2.284 0 0 1-2.284-2.284V4.909a2.284 2.284 0 0 1 2.284-2.284Z" />
												<path d="m3.333 12.5 3.334-3.333c.773-.745 1.726-.745 2.5 0l4.166 4.166" />
												<path d="m11.667 11.667.833-.834c.774-.744 1.726-.744 2.5 0l1.667 1.667" />
											</g>
										</ToolbarIcon>
										<span className="landing-toolbar-key">9</span>
									</button>
									<button className="landing-toolbar-button" type="button">
										<ToolbarIcon>
											<g strokeWidth="1.5">
												<path d="M19 20H8.5l-4.21-4.3a1 1 0 0 1 0-1.41l10-10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3" />
												<path d="m18 13.3-6.3-6.3" />
											</g>
										</ToolbarIcon>
										<span className="landing-toolbar-key">0</span>
									</button>
								</div>
								<span className="landing-toolbar-divider" />
								<div className="landing-toolbar-group">
									<button className="landing-toolbar-button" type="button">
										<ToolbarIcon>
											<g strokeWidth="1.5">
												<path d="M12 3 8 10h8Z" />
												<circle cx="17" cy="17" r="3" />
												<rect x="4" y="14" width="6" height="6" rx="1" />
											</g>
										</ToolbarIcon>
									</button>
								</div>
							</div>
							<div className="landing-selection-outline" aria-hidden="true" />
							<div className="landing-free-label landing-free-label-top" aria-hidden="true">
								drag ideas, notes, and references into one place
							</div>
							<div className="landing-free-label landing-free-label-bottom" aria-hidden="true">
								excalidraw-style canvas with structured blocks
							</div>
							<div className="landing-scribble landing-scribble-left" aria-hidden="true" />
							<div className="landing-scribble landing-scribble-right" aria-hidden="true" />

							<section className="landing-hero-block">
								<p className="landing-scene-label">{landingContent.scene.label}</p>
								<h1 className="landing-display">{landingContent.scene.title}</h1>
								<p className="landing-subtitle">{landingContent.scene.description}</p>
								<div className="landing-hero-actions">
									<a className="landing-button landing-button-primary" href={landingContent.scene.primaryHref}>
										{landingContent.scene.primaryLabel}
									</a>
									<a
										className="landing-button landing-button-secondary"
										href={landingContent.scene.secondaryHref}
									>
										{landingContent.scene.secondaryLabel}
									</a>
								</div>
							</section>

							<article className="landing-canvas-card landing-cluster-card">
								<div className="landing-card-topline">
									<span className="landing-chip landing-chip-soft">Canvas</span>
									<span className="landing-meta">Loose thinking</span>
								</div>
								<h2 className="landing-card-title">{landingContent.canvas.clusterTitle}</h2>
								<p className="landing-card-copy">{landingContent.canvas.clusterDescription}</p>
								<div className="landing-cluster-grid" aria-hidden="true">
									<div className="landing-cluster-thumb landing-cluster-thumb-photo" />
									<div className="landing-sticky-note" data-tone="mint">
										Study questions
									</div>
									<div className="landing-sticky-note" data-tone="gold">
										UI ideas
									</div>
									<div className="landing-sticky-note" data-tone="sky">
										Research clips
									</div>
									<div className="landing-sticky-note" data-tone="peach">
										Next steps
									</div>
									<div className="landing-cluster-thumb landing-cluster-thumb-image" />
								</div>
							</article>

							<article className="landing-canvas-card landing-note-card">
								<div className="landing-card-topline">
									<span className="landing-chip">Markdown</span>
									<span className="landing-meta">Saved note</span>
								</div>
								<h2 className="landing-card-title">{landingContent.canvas.noteTitle}</h2>
								<p className="landing-card-copy">{landingContent.canvas.noteDescription}</p>
								<div className="landing-note-sections" aria-hidden="true">
									<div className="landing-note-section">
										<p>Summary</p>
										<span data-accent="true" />
									</div>
									<div className="landing-note-section">
										<p>Why it matters</p>
										<span />
									</div>
									<div className="landing-note-section">
										<p>Open questions</p>
										<span />
									</div>
								</div>
							</article>

							<div className="landing-sketch-note" aria-hidden="true">
								<p>Collect first, organize later.</p>
								<span>rough note</span>
							</div>

							<div className="landing-image-reference" aria-hidden="true">
								<div className="landing-image-frame">
									<div className="landing-image-art" />
								</div>
								<span>Reference image</span>
							</div>
						</div>
					</div>
				</section>
			</main>
		</div>
	);
}
