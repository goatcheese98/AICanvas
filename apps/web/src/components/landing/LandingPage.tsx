import { waitlistSchemas } from '@ai-canvas/shared/schemas';
import { startTransition, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { joinWaitlist } from '../../lib/api';
import { LandingCanvasScene } from './LandingCanvasScene';
import { landingContent, landingStoryChapters } from './landing-content';
import './landing.css';

type WaitlistStatus = 'idle' | 'submitting' | 'success' | 'error';

type LandingBoardStyle = CSSProperties & {
	'--landing-board-x': string;
	'--landing-board-y': string;
	'--landing-board-scale': string;
};

export function LandingPage() {
	const sectionRefs = useRef<Array<HTMLElement | null>>([]);
	const [activeChapterId, setActiveChapterId] = useState(landingStoryChapters[0]?.id ?? 'capture');
	const [email, setEmail] = useState('');
	const [waitlistStatus, setWaitlistStatus] = useState<WaitlistStatus>('idle');
	const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);

	useEffect(() => {
		if (typeof IntersectionObserver === 'undefined') return;

		const observer = new IntersectionObserver(
			(entries) => {
				const nextEntry = [...entries]
					.filter((entry) => entry.isIntersecting)
					.sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
				const nextId = nextEntry?.target.getAttribute('data-chapter-id');
				if (!nextId) return;
				startTransition(() => {
					setActiveChapterId((current) => (current === nextId ? current : nextId));
				});
			},
			{
				rootMargin: '-35% 0px -45% 0px',
				threshold: [0.25, 0.45, 0.7],
			},
		);

		for (const node of sectionRefs.current) {
			if (node) observer.observe(node);
		}

		return () => observer.disconnect();
	}, []);

	const activeChapter = useMemo(
		() =>
			landingStoryChapters.find((chapter) => chapter.id === activeChapterId) ??
			landingStoryChapters[0],
		[activeChapterId],
	);

	const boardStyle: LandingBoardStyle = {
		'--landing-board-x': `${activeChapter.camera.x}px`,
		'--landing-board-y': `${activeChapter.camera.y}px`,
		'--landing-board-scale': String(activeChapter.camera.scale),
	};

	const handleWaitlistSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const submission = waitlistSchemas.join.safeParse({
			email,
			source: 'landing-footer',
		});

		if (!submission.success) {
			setWaitlistStatus('error');
			setWaitlistMessage(submission.error.issues[0]?.message ?? 'Enter a valid email address.');
			return;
		}

		setWaitlistStatus('submitting');
		setWaitlistMessage('Saving your spot...');

		try {
			const response = await joinWaitlist(submission.data);
			setWaitlistStatus('success');
			setWaitlistMessage(response.message);
			setEmail('');
		} catch (error) {
			setWaitlistStatus('error');
			setWaitlistMessage(
				error instanceof Error ? error.message : 'Unable to join the waitlist right now.',
			);
		}
	};

	return (
		<div className="landing-page">
			<main id="top" className="landing-shell">
				<section className="landing-window">
					<header className="landing-window-bar">
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
						<nav className="landing-window-nav" aria-label="Landing">
							<a className="landing-link landing-window-nav-link" href="#capture">
								Canvas story
							</a>
							<a className="landing-link landing-window-nav-link" href="#waitlist">
								Waitlist
							</a>
							<a className="landing-link landing-window-nav-link" href={landingContent.scene.secondaryHref}>
								{landingContent.scene.secondaryLabel}
							</a>
						</nav>
					</header>

					<div className="landing-story-grid">
						<aside className="landing-sidebar">
							<div className="landing-sidebar-panel">
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

								<div className="landing-proof-grid" aria-label="Product proof points">
									{landingContent.proof.map((proof) => (
										<div key={proof.label} className="landing-proof-card">
											<strong>{proof.value}</strong>
											<span>{proof.label}</span>
										</div>
									))}
								</div>

								<div className="landing-progress-list" aria-label="Story chapters">
									{landingStoryChapters.map((chapter) => (
										<a
											key={chapter.id}
											aria-current={chapter.id === activeChapter.id ? 'true' : undefined}
											className="landing-progress-link"
											data-active={chapter.id === activeChapter.id ? 'true' : undefined}
											href={`#${chapter.id}`}
										>
											<span>{chapter.eyebrow}</span>
											<strong>{chapter.label}</strong>
										</a>
									))}
								</div>
							</div>
						</aside>

						<div className="landing-canvas-column">
							<div className="landing-canvas-sticky">
								<LandingCanvasScene
									activeChapter={activeChapter}
									boardStyle={boardStyle}
									chapters={landingStoryChapters}
								/>
							</div>
						</div>

						<div className="landing-rail">
							{landingStoryChapters.map((chapter, index) => (
								<section
									key={chapter.id}
									id={chapter.id}
									ref={(node) => {
										sectionRefs.current[index] = node;
									}}
									className="landing-rail-card"
									data-active={chapter.id === activeChapter.id ? 'true' : undefined}
									data-chapter-id={chapter.id}
								>
									<p className="landing-rail-label">{chapter.eyebrow}</p>
									<h2 className="landing-rail-title">{chapter.title}</h2>
									<p className="landing-rail-copy">{chapter.description}</p>
									<p className="landing-rail-detail">{chapter.detail}</p>
									<ul className="landing-rail-list">
										{chapter.bullets.map((bullet) => (
											<li key={bullet}>{bullet}</li>
										))}
									</ul>
									<div className="landing-rail-metric">
										<span>{chapter.metricLabel}</span>
										<strong>{chapter.metricValue}</strong>
									</div>
								</section>
							))}

							<section id="waitlist" className="landing-rail-card landing-rail-card-form">
								<p className="landing-rail-label">Final chapter</p>
								<h2 className="landing-rail-title">{landingContent.waitlist.title}</h2>
								<p className="landing-rail-copy">{landingContent.waitlist.description}</p>
								<form
									aria-label="Landing waitlist form"
									className="landing-waitlist-form"
									onSubmit={(event) => {
										void handleWaitlistSubmit(event);
									}}
								>
									<label className="landing-waitlist-label" htmlFor="landing-email">
										Work email
									</label>
									<input
										id="landing-email"
										autoComplete="email"
										className="landing-waitlist-input"
										name="email"
										onChange={(event) => {
											setEmail(event.target.value);
											if (waitlistStatus !== 'idle') {
												setWaitlistStatus('idle');
												setWaitlistMessage(null);
											}
										}}
										placeholder="name@company.com"
										type="email"
										value={email}
									/>
									<p className="landing-waitlist-helper">{landingContent.waitlist.helper}</p>
									<button
										className="landing-button landing-button-primary landing-waitlist-submit"
										disabled={waitlistStatus === 'submitting'}
										type="submit"
									>
										{waitlistStatus === 'submitting'
											? 'Requesting access...'
											: landingContent.waitlist.submitLabel}
									</button>
									{waitlistMessage ? (
										<p
											aria-live="polite"
											className="landing-waitlist-message"
											data-status={waitlistStatus}
										>
											{waitlistMessage}
										</p>
									) : null}
								</form>
							</section>
						</div>
					</div>
				</section>
			</main>
		</div>
	);
}
