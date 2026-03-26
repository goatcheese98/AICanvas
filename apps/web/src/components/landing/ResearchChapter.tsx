type ResearchChapterProps = {
	active: boolean;
};

export function ResearchChapter({ active }: ResearchChapterProps) {
	return (
		<>
			<article
				className="landing-board-card landing-board-research-card"
				data-chapter="research"
				data-active={active ? 'true' : undefined}
			>
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

			<article
				className="landing-board-card landing-board-signal-card"
				data-chapter="research"
				data-active={active ? 'true' : undefined}
			>
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

			<article
				className="landing-board-card landing-board-embed-card"
				data-chapter="research"
				data-active={active ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Embed</span>
					<span className="landing-meta">Reference video</span>
				</div>
				<div className="landing-embed-player">
					<div className="landing-embed-screen">
						<div className="landing-embed-tutorial">
							<div className="landing-tutorial-step active">
								<div className="landing-tutorial-icon">1</div>
								<div className="landing-tutorial-text">
									<span>Create your first board</span>
									<div className="landing-tutorial-bar" />
								</div>
							</div>
							<div className="landing-tutorial-step">
								<div className="landing-tutorial-icon">2</div>
								<div className="landing-tutorial-text">
									<span>Add sticky notes</span>
									<div className="landing-tutorial-bar" />
								</div>
							</div>
							<div className="landing-tutorial-step">
								<div className="landing-tutorial-icon">3</div>
								<div className="landing-tutorial-text">
									<span>Share with your team</span>
									<div className="landing-tutorial-bar" />
								</div>
							</div>
						</div>
						<div className="landing-embed-progress">
							<div className="landing-embed-progress-bar" />
						</div>
					</div>
					<div className="landing-embed-controls">
						<button className="landing-embed-btn" type="button" aria-label="Play preview clip">
							<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
								<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
							</svg>
						</button>
						<span className="landing-embed-time">1:24 / 3:45</span>
						<button className="landing-embed-btn" type="button" aria-label="Pause preview clip">
							<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
								<path d="M16 5v14h4V5h-4zM6 19h4V5H6v14z" />
							</svg>
						</button>
					</div>
				</div>
			</article>

			{/* Flow connector */}
			<div className="landing-flow-connector landing-flow-research-to-plan" aria-hidden="true">
				<svg viewBox="0 0 180 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
					<path d="M0 25 Q45 45, 90 30 T180 35" />
				</svg>
			</div>
		</>
	);
}
