import type { CSSProperties, FormEventHandler, ReactNode } from 'react';
import type { LandingStoryChapter } from './landing-content';

type LandingCanvasSceneProps = {
	activeChapter: LandingStoryChapter;
	activeProgressChapterId: string;
	boardStyle: CSSProperties;
	chapters: LandingStoryChapter[];
	email: string;
	waitlistMessage: string | null;
	waitlistStatus: 'idle' | 'submitting' | 'success' | 'error';
	onEmailChange: (value: string) => void;
	onWaitlistSubmit: FormEventHandler<HTMLFormElement>;
};

function ToolbarIcon({
	children,
	viewBox = '0 0 24 24',
}: { children: ReactNode; viewBox?: string }) {
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

function BoardLogo({
	kind,
}: {
	kind: 'figma' | 'notion' | 'loom';
}) {
	if (kind === 'figma') {
		return (
			<svg aria-hidden="true" className="landing-logo-svg" viewBox="0 0 24 24">
				<rect x="5" y="2.5" width="6.8" height="6.8" rx="3.2" fill="#f24e1e" />
				<rect x="5" y="9.6" width="6.8" height="6.8" rx="3.2" fill="#a259ff" />
				<rect x="5" y="16.7" width="6.8" height="6.8" rx="3.2" fill="#0acf83" />
				<rect x="12.2" y="2.5" width="6.8" height="6.8" rx="3.2" fill="#ff7262" />
				<circle cx="15.6" cy="13" r="3.4" fill="#1abcfe" />
			</svg>
		);
	}

	if (kind === 'notion') {
		return (
			<svg aria-hidden="true" className="landing-logo-svg" viewBox="0 0 24 24">
				<path
					d="M5.8 5.2 14.7 4.6c2-.1 2.5 0 3 .4l1.7 1.3c.7.5.9.8.9 1.4v10.7c0 .7-.2 1.1-.9 1.1l-10.3.6c-.6 0-.9-.1-1.2-.5l-2-2.6c-.4-.5-.5-.8-.5-1.3V6.4c0-.7.2-1 1.1-1.2Z"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.7"
				/>
				<path
					d="M9.4 9.1v7.3m0-7.3 4.9 7.2V9.6"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.7"
				/>
			</svg>
		);
	}

	return (
		<svg aria-hidden="true" className="landing-logo-svg" viewBox="0 0 24 24">
			<circle cx="9" cy="8.2" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
			<circle cx="15.2" cy="8.2" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
			<circle cx="9" cy="15.8" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
			<circle cx="15.2" cy="15.8" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
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

function CanvasBoard({
	email,
	waitlistMessage,
	waitlistStatus,
	onEmailChange,
	onWaitlistSubmit,
	activeChapterId,
}: {
	email: string;
	waitlistMessage: string | null;
	waitlistStatus: 'idle' | 'submitting' | 'success' | 'error';
	onEmailChange: (value: string) => void;
	onWaitlistSubmit: FormEventHandler<HTMLFormElement>;
	activeChapterId: string;
}) {
	return (
		<>
			<div className="landing-board-marker landing-board-marker-capture">rough capture</div>
			<div className="landing-board-marker landing-board-marker-research">research wall</div>
			<div className="landing-board-marker landing-board-marker-plan">planning lane</div>
			<div className="landing-board-marker landing-board-marker-polish">polished outputs</div>
			<div className="landing-board-marker landing-board-marker-waitlist">early access</div>

			<div className="landing-board-track landing-board-track-main" />
			<div className="landing-board-track landing-board-track-side" />
			<div className="landing-board-orb landing-board-orb-a" />
			<div className="landing-board-orb landing-board-orb-b" />
			<div className="landing-board-dots landing-board-dots-a" />
			<div className="landing-board-dots landing-board-dots-b" />

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
					<div className="landing-cluster-thumb landing-cluster-thumb-photo">
						<span>Onboarding screenshot</span>
					</div>
					<div className="landing-sticky-note" data-tone="mint">
						<strong>Study questions</strong>
						<small>What blocks the first session?</small>
					</div>
					<div className="landing-sticky-note" data-tone="gold">
						<strong>UI ideas</strong>
						<small>Keep evidence docked beside drafts</small>
					</div>
					<div className="landing-sticky-note" data-tone="sky">
						<strong>Research clips</strong>
						<small>3 call excerpts worth revisiting</small>
					</div>
					<div className="landing-sticky-note" data-tone="peach">
						<strong>Next steps</strong>
						<small>Summarize friction, map options</small>
					</div>
					<div className="landing-cluster-thumb landing-cluster-thumb-voice">
						<p>Voice memo</p>
						<span>"Need one place for notes + plan."</span>
					</div>
				</div>
			</article>

			<article className="landing-board-card landing-board-links-card">
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Links</span>
					<span className="landing-meta">Quick saves</span>
				</div>
				<div className="landing-links-list" aria-hidden="true">
					<span>loom.com/share/onboarding-friction</span>
					<span>docs.google.com/research-synthesis</span>
					<span>figma.com/file/new-first-run-flow</span>
				</div>
				<div className="landing-board-source-badges" aria-hidden="true">
					<div className="landing-board-logo-chip">
						<BoardLogo kind="loom" />
						<span>Loom</span>
					</div>
					<div className="landing-board-logo-chip">
						<BoardLogo kind="figma" />
						<span>Figma</span>
					</div>
					<div className="landing-board-logo-chip">
						<BoardLogo kind="notion" />
						<span>Notion</span>
					</div>
				</div>
			</article>

			<div className="landing-board-links-arrow" aria-hidden="true">
				<svg viewBox="0 0 220 120">
					<path d="M18 100c22-32 64-51 113-58" />
					<path d="m123 31 20 9-18 12" />
				</svg>
				<span>saved sources</span>
			</div>

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

			<article className="landing-board-card landing-board-signal-card">
				<div className="landing-card-topline">
					<span className="landing-chip">Snapshot</span>
					<span className="landing-meta">Signal check</span>
				</div>
				<div className="landing-signal-meter" aria-hidden="true">
					<div>
						<strong>Setup friction</strong>
						<span>High signal</span>
					</div>
					<div>
						<strong>Context switching</strong>
						<span>Repeated complaint</span>
					</div>
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

			<article className="landing-board-card landing-board-decision-card">
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Decision</span>
					<span className="landing-meta">Working direction</span>
				</div>
				<p className="landing-decision-text">
					Keep capture, research, and planning visible together instead of forcing a handoff.
				</p>
			</article>

			<div className="landing-board-plan-flow" aria-hidden="true">
				<div className="landing-board-flow-shape landing-board-flow-shape-rect">
					<span>collect</span>
				</div>
				<div className="landing-board-flow-shape landing-board-flow-shape-diamond">
					<span>shape</span>
				</div>
				<div className="landing-board-flow-shape landing-board-flow-shape-ellipse">
					<span>ship</span>
				</div>
				<svg className="landing-board-flow-connector" viewBox="0 0 340 120">
					<path d="M40 58h106" />
					<path d="M196 58h92" />
					<path d="m136 50 12 8-12 8" />
					<path d="m278 50 12 8-12 8" />
				</svg>
			</div>

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

			<form
				aria-label="Landing waitlist form"
				className="landing-board-card landing-board-waitlist-card"
				data-active={activeChapterId === 'waitlist' ? 'true' : undefined}
				onSubmit={onWaitlistSubmit}
			>
				<div className="landing-card-topline">
					<span className="landing-chip">Waitlist</span>
					<span className="landing-meta">Opening access</span>
				</div>
				<h2 className="landing-card-title">Join the waitlist</h2>
				<p className="landing-card-copy">
					Get early access when RoopStudio opens its first release wave.
				</p>
				<label className="landing-board-form-label" htmlFor="landing-board-email">
					Work email
				</label>
				<input
					id="landing-board-email"
					autoComplete="email"
					className="landing-board-input"
					name="email"
					onChange={(event) => onEmailChange(event.target.value)}
					placeholder="name@company.com"
					type="email"
					value={email}
				/>
				<button
					className="landing-board-submit"
					disabled={waitlistStatus === 'submitting'}
					type="submit"
				>
					{waitlistStatus === 'submitting' ? 'Requesting...' : 'Request access'}
				</button>
				{waitlistMessage ? (
					<p className="landing-board-message" data-status={waitlistStatus}>
						{waitlistMessage}
					</p>
				) : null}
			</form>
		</>
	);
}

export function LandingCanvasScene({
	activeChapter,
	activeProgressChapterId,
	boardStyle,
	chapters,
	email,
	waitlistMessage,
	waitlistStatus,
	onEmailChange,
	onWaitlistSubmit,
}: LandingCanvasSceneProps) {
	return (
		<div className="landing-canvas-shell">
			<CanvasToolbar />

			<div className="landing-canvas-hud">
				<div>
					<p>{activeChapter.eyebrow}</p>
					<h2>{activeChapter.title}</h2>
					<span>{activeChapter.description}</span>
				</div>
			</div>

			<div className="landing-canvas-viewport">
				<div className="landing-canvas-board" style={boardStyle}>
					<CanvasBoard
						activeChapterId={activeChapter.id}
						email={email}
						onEmailChange={onEmailChange}
						onWaitlistSubmit={onWaitlistSubmit}
						waitlistMessage={waitlistMessage}
						waitlistStatus={waitlistStatus}
					/>
				</div>
			</div>

			<div className="landing-canvas-footer">
				<span className="landing-canvas-footer-label">{activeChapter.label}</span>
				<div className="landing-canvas-pips" aria-hidden="true">
					{chapters.map((chapter) => (
						<span
							key={chapter.id}
							data-active={chapter.id === activeProgressChapterId ? 'true' : undefined}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
