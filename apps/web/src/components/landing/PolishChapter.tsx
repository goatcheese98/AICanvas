type PolishChapterProps = {
	active: boolean;
};

export function PolishChapter({ active }: PolishChapterProps) {
	return (
		<>
			<article
				className="landing-board-card landing-board-doc-card"
				data-chapter="polish"
				data-active={active ? 'true' : undefined}
			>
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

			<article
				className="landing-board-card landing-board-richdoc-card"
				data-chapter="polish"
				data-active={active ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Document</span>
					<span className="landing-meta">Full editor</span>
				</div>
				<div className="landing-richdoc-content" aria-hidden="true">
					<div className="landing-richdoc-heading">Product Strategy Q2</div>
					<div className="landing-richdoc-paragraph">
						<span className="landing-richdoc-bold">Objective:</span> Reduce time-to-value by 40% through improved onboarding.
					</div>
					<div className="landing-richdoc-list">
						<div className="landing-richdoc-item">Simplify first-run experience</div>
						<div className="landing-richdoc-item">Add contextual tooltips</div>
						<div className="landing-richdoc-item">Create template library</div>
					</div>
					<div className="landing-richdoc-quote">
						"Users who complete the new onboarding are 3x more likely to become paying customers."
					</div>
					<div className="landing-richdoc-toolbar">
						<span>B</span>
						<span>I</span>
						<span>U</span>
						<span>•</span>
						<span>1.</span>
						<span>❝</span>
					</div>
				</div>
			</article>

			<article
				className="landing-board-card landing-board-prototype-card"
				data-chapter="polish"
				data-active={active ? 'true' : undefined}
			>
				<div className="landing-card-topline">
					<span className="landing-chip landing-chip-soft">Prototype</span>
					<span className="landing-meta">Screen strip</span>
				</div>
				<div className="landing-prototype-strip" aria-hidden="true">
					<div className="landing-prototype-frame">
						<div className="landing-prototype-header">
							<div className="landing-prototype-dot" />
							<div className="landing-prototype-dot" />
							<div className="landing-prototype-dot" />
						</div>
						<div className="landing-prototype-body">
							<div className="landing-prototype-content">
								<div className="landing-prototype-line" />
								<div className="landing-prototype-line short" />
								<div className="landing-prototype-button">Get started</div>
							</div>
						</div>
					</div>
					<div className="landing-prototype-frame">
						<div className="landing-prototype-header">
							<div className="landing-prototype-dot" />
							<div className="landing-prototype-dot" />
							<div className="landing-prototype-dot" />
						</div>
						<div className="landing-prototype-body">
							<div className="landing-prototype-sidebar" />
							<div className="landing-prototype-main">
								<div className="landing-prototype-card" />
								<div className="landing-prototype-card" />
							</div>
						</div>
					</div>
					<div className="landing-prototype-frame">
						<div className="landing-prototype-header">
							<div className="landing-prototype-dot" />
							<div className="landing-prototype-dot" />
							<div className="landing-prototype-dot" />
						</div>
						<div className="landing-prototype-body center">
							<div className="landing-prototype-success">✓</div>
							<div className="landing-prototype-complete">All set!</div>
						</div>
					</div>
				</div>
			</article>

			{/* Flow connector */}
			<div className="landing-flow-connector landing-flow-polish-to-waitlist" aria-hidden="true">
				<svg viewBox="0 0 180 100" preserveAspectRatio="none">
					<path d="M0 80 Q45 70, 90 45 T160 20" />
				</svg>
			</div>
		</>
	);
}
