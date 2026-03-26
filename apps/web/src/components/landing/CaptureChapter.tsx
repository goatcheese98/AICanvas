import { BoardLogo } from './landing-canvas-scene-utils';

type CaptureChapterProps = {
	active: boolean;
};

export function CaptureChapter({ active }: CaptureChapterProps) {
	return (
		<>
			<article
				className="landing-board-card landing-board-cluster-card"
				data-chapter="capture"
				data-active={active ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip">Canvas</span>
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

			<article
				className="landing-board-card landing-board-note-card"
				data-chapter="capture"
				data-active={active ? 'true' : undefined}
			>
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

			<article
				className="landing-board-card landing-board-links-card"
				data-chapter="capture"
				data-active={active ? 'true' : undefined}
			>
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

			{/* Flow connector */}
			<div className="landing-flow-connector landing-flow-capture-to-research" aria-hidden="true">
				<svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
					<path d="M0 40 Q50 20, 100 30 T200 25" />
				</svg>
			</div>
		</>
	);
}
