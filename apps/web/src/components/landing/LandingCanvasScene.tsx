import type { CSSProperties, ReactNode } from 'react';
import type { LandingStoryChapter } from './landing-content';

type LandingCanvasSceneProps = {
	activeChapter: LandingStoryChapter;
	boardStyle: CSSProperties;
	chapters: LandingStoryChapter[];
};

function ToolbarIcon({ children, viewBox = '0 0 24 24' }: { children: ReactNode; viewBox?: string }) {
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

function CanvasToolbar() {
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
						<path d="M10 13.958a1.042 1.042 0 1 0 0-2.083 1.042 1.042 0 0 0 0 2.083Z" strokeWidth="1.25" />
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

function CanvasBoard() {
	return (
		<>
			<div className="landing-board-marker landing-board-marker-capture">rough capture</div>
			<div className="landing-board-marker landing-board-marker-research">research wall</div>
			<div className="landing-board-marker landing-board-marker-plan">planning lane</div>
			<div className="landing-board-marker landing-board-marker-polish">polished outputs</div>
			<div className="landing-board-marker landing-board-marker-review">review loop</div>
			<div className="landing-board-marker landing-board-marker-waitlist">early access</div>

			<div className="landing-board-track landing-board-track-main" />
			<div className="landing-board-track landing-board-track-side" />
			<div className="landing-board-orb landing-board-orb-a" />
			<div className="landing-board-orb landing-board-orb-b" />

			<article className="landing-board-card landing-board-cluster-card">
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Canvas</span>
					<span className="landing-meta">Loose thinking</span>
				</div>
				<h2 className="landing-card-title">Loose notes and references</h2>
				<p className="landing-card-copy">
					Drop in screenshots, prompts, notes, and quick ideas before you decide what deserves
					structure.
				</p>
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

			<article className="landing-board-card landing-board-note-card">
				<div className="landing-card-topline">
					<span className="landing-chip">Markdown</span>
					<span className="landing-meta">Saved note</span>
				</div>
				<h2 className="landing-card-title">Course notes, links, and half-formed ideas</h2>
				<p className="landing-card-copy">
					Capture raw thinking first, then decide what deserves more structure.
				</p>
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

			<article className="landing-board-card landing-board-research-card">
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Research</span>
					<span className="landing-meta">Source stack</span>
				</div>
				<h2 className="landing-card-title">Evidence beside the board</h2>
				<p className="landing-card-copy">
					Compare clips, summaries, and unanswered questions without switching context.
				</p>
				<div className="landing-research-rows" aria-hidden="true">
					<div className="landing-research-row">
						<strong>User interviews</strong>
						<span>Patterns from support calls</span>
					</div>
					<div className="landing-research-row">
						<strong>Competitor notes</strong>
						<span>Pricing, onboarding, and empty states</span>
					</div>
					<div className="landing-research-row">
						<strong>Open questions</strong>
						<span>Where adoption drops after first setup</span>
					</div>
				</div>
				<div className="landing-research-tags" aria-hidden="true">
					<span>Problem framing</span>
					<span>Signals</span>
					<span>Quotes</span>
				</div>
			</article>

			<article className="landing-board-card landing-board-kanban-card">
				<div className="landing-card-topline">
					<span className="landing-chip">Kanban</span>
					<span className="landing-meta">Execution plan</span>
				</div>
				<h2 className="landing-card-title">From findings to next actions</h2>
				<div className="landing-kanban-grid" aria-hidden="true">
					<div className="landing-kanban-column">
						<p>Backlog</p>
						<span>Refine interview themes</span>
						<span>Review onboarding friction</span>
					</div>
					<div className="landing-kanban-column">
						<p>In progress</p>
						<span>Draft launch narrative</span>
						<span>Score opportunities</span>
					</div>
					<div className="landing-kanban-column">
						<p>Ready to ship</p>
						<span>Write release brief</span>
						<span>Sign off prototype</span>
					</div>
				</div>
			</article>

			<article className="landing-board-card landing-board-timeline-card">
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Timeline</span>
					<span className="landing-meta">Milestones</span>
				</div>
				<div className="landing-timeline" aria-hidden="true">
					<span>Research synthesis</span>
					<span>Scope lock</span>
					<span>Prototype review</span>
					<span>Launch prep</span>
				</div>
			</article>

			<article className="landing-board-card landing-board-doc-card">
				<div className="landing-card-topline">
					<span className="landing-chip">Brief</span>
					<span className="landing-meta">Polished artifact</span>
				</div>
				<h2 className="landing-card-title">A board that can also present the answer</h2>
				<p className="landing-card-copy">
					Write the decision memo with the raw context still visible around it.
				</p>
				<div className="landing-doc-lines" aria-hidden="true">
					<span className="landing-doc-line landing-doc-line-strong" />
					<span className="landing-doc-line" />
					<span className="landing-doc-line" />
					<span className="landing-doc-line landing-doc-line-short" />
					<span className="landing-doc-line" />
				</div>
			</article>

			<article className="landing-board-card landing-board-prototype-card">
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Prototype</span>
					<span className="landing-meta">Screen strip</span>
				</div>
				<div className="landing-prototype-strip" aria-hidden="true">
					<div />
					<div />
					<div />
				</div>
			</article>

			<article className="landing-board-card landing-board-review-card">
				<div className="landing-card-topline">
					<span className="landing-chip">Review</span>
					<span className="landing-meta">Feedback in context</span>
				</div>
				<div className="landing-review-thread" aria-hidden="true">
					<div className="landing-comment-pill">Jess: tighten the problem statement</div>
					<div className="landing-comment-pill landing-comment-pill-soft">
						Brie: this aligns with the interview evidence
					</div>
					<div className="landing-comment-pill landing-comment-pill-accent">
						AI: summarize launch risks
					</div>
				</div>
			</article>

			<article className="landing-board-card landing-board-ai-card">
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Prompt</span>
					<span className="landing-meta">Inline support</span>
				</div>
				<div className="landing-ai-console" aria-hidden="true">
					<p>/summarize the strongest signals from this board</p>
					<span>Response pulls from notes, research, and planning blocks in view.</span>
				</div>
			</article>

			<article className="landing-board-card landing-board-waitlist-card" aria-hidden="true">
				<div className="landing-card-topline">
					<span className="landing-chip">Waitlist</span>
					<span className="landing-meta">Opening access</span>
				</div>
				<h2 className="landing-card-title">RoopStudio early access</h2>
				<p className="landing-card-copy">Join the list to see this workflow come together on a real canvas.</p>
				<div className="landing-fake-form">
					<span>name@company.com</span>
					<strong>Request access</strong>
				</div>
			</article>
		</>
	);
}

export function LandingCanvasScene({
	activeChapter,
	boardStyle,
	chapters,
}: LandingCanvasSceneProps) {
	return (
		<div className="landing-canvas-shell">
			<CanvasToolbar />

			<div className="landing-canvas-hud">
				<div>
					<p>{activeChapter.label}</p>
					<h2>{activeChapter.title}</h2>
				</div>
				<strong>{activeChapter.metricValue}</strong>
			</div>

			<div className="landing-canvas-viewport">
				<div className="landing-canvas-board" style={boardStyle}>
					<CanvasBoard />
				</div>
			</div>

			<div className="landing-canvas-footer">
				<div>
					<span className="landing-canvas-footer-label">{activeChapter.metricLabel}</span>
					<p>{activeChapter.detail}</p>
				</div>
				<div className="landing-canvas-pips" aria-hidden="true">
					{chapters.map((chapter) => (
						<span key={chapter.id} data-active={chapter.id === activeChapter.id ? 'true' : undefined} />
					))}
				</div>
			</div>
		</div>
	);
}
