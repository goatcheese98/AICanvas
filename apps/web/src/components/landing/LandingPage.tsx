import { useMountEffect } from '@/hooks/useMountEffect';
import { waitlistSchemas } from '@ai-canvas/shared/schemas';
import {
	type CSSProperties,
	type FormEvent,
	startTransition,
	useMemo,
	useRef,
	useState,
} from 'react';
import { joinWaitlist } from '../../lib/api';
import { LandingCanvasScene } from './LandingCanvasScene';
import { landingContent, landingStoryChapters, landingWaitlistChapter } from './landing-content';
import './landing.css';

type WaitlistStatus = 'idle' | 'submitting' | 'success' | 'error';

type LandingBoardStyle = CSSProperties & {
	'--landing-board-x': string;
	'--landing-board-y': string;
	'--landing-board-scale': string;
};

export function LandingPage() {
	const sectionRefs = useRef<Array<HTMLElement | null>>([]);
	const waitlistRef = useRef<HTMLElement | null>(null);
	const [activeChapterId, setActiveChapterId] = useState(landingStoryChapters[0]?.id ?? 'capture');
	const [email, setEmail] = useState('');
	const [waitlistStatus, setWaitlistStatus] = useState<WaitlistStatus>('idle');
	const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);

	const scrollToChapter = (chapterId: string, behavior: ScrollBehavior = 'smooth') => {
		const chapterIndex = landingStoryChapters.findIndex((chapter) => chapter.id === chapterId);

		startTransition(() => {
			setActiveChapterId(chapterId);
		});

		if (typeof window !== 'undefined') {
			window.history.replaceState(null, '', `#${chapterId}`);
		}

		if (typeof window === 'undefined') return;

		if (chapterId === landingStoryChapters[0]?.id) {
			window.scrollTo({ top: 0, behavior });
			return;
		}

		if (chapterId === landingWaitlistChapter.id) {
			const node = waitlistRef.current;
			if (!node) return;
			const targetTop =
				window.scrollY + node.getBoundingClientRect().top - window.innerHeight * 0.18;
			window.scrollTo({
				top: Math.max(0, targetTop),
				behavior,
			});
			return;
		}

		if (chapterIndex === -1) return;

		const node = sectionRefs.current[chapterIndex];

		if (!node) return;

		const targetTop = window.scrollY + node.getBoundingClientRect().top - window.innerHeight * 0.22;

		window.scrollTo({
			top: Math.max(0, targetTop),
			behavior,
		});
	};

	useMountEffect(() => {
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

		if (waitlistRef.current) {
			observer.observe(waitlistRef.current);
		}

		return () => observer.disconnect();
	});

	useMountEffect(() => {
		if (typeof window === 'undefined') return;
		const initialHash = window.location.hash.replace('#', '');
		if (!initialHash) return;
		const chapterExists = landingStoryChapters.some((chapter) => chapter.id === initialHash);
		if (!chapterExists) return;

		requestAnimationFrame(() => {
			scrollToChapter(initialHash, 'auto');
		});
	});

	const activeChapter = useMemo(
		() =>
			landingStoryChapters.find((chapter) => chapter.id === activeChapterId) ??
			(activeChapterId === landingWaitlistChapter.id
				? landingWaitlistChapter
				: landingStoryChapters[0]),
		[activeChapterId],
	);

	const progressChapterId =
		activeChapter.id === landingWaitlistChapter.id
			? (landingStoryChapters[landingStoryChapters.length - 1]?.id ?? activeChapter.id)
			: activeChapter.id;

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
							<button
								type="button"
								className="landing-link landing-window-nav-link"
								onClick={(event) => {
									event.preventDefault();
									scrollToChapter('capture');
								}}
							>
								Canvas story
							</button>
							<button
								type="button"
								className="landing-link landing-window-nav-link"
								onClick={(event) => {
									event.preventDefault();
									scrollToChapter('waitlist');
								}}
							>
								Waitlist
							</button>
							<a
								className="landing-link landing-window-nav-link landing-window-nav-cta"
								href={landingContent.scene.secondaryHref}
							>
								{landingContent.scene.secondaryLabel}
							</a>
						</nav>
					</header>

					<div className="landing-story-frame">
						<div className="landing-stage-sticky">
							<aside className="landing-sidebar">
								<div className="landing-sidebar-panel">
									<div className="landing-sidebar-copy">
										<p className="landing-scene-label">{landingContent.scene.label}</p>
										<h1 className="landing-display">{landingContent.scene.title}</h1>
										<p className="landing-subtitle">{landingContent.scene.description}</p>
									</div>
									<div className="landing-sidebar-dock">
										<div className="landing-hero-actions">
											<a
												className="landing-button landing-button-primary"
												href={landingContent.scene.primaryHref}
												onClick={(event) => {
													event.preventDefault();
													scrollToChapter('waitlist');
												}}
											>
												{landingContent.scene.primaryLabel}
											</a>
											<a
												className="landing-button landing-button-secondary"
												href={landingContent.scene.secondaryHref}
											>
												{landingContent.scene.secondaryLabel}
											</a>
										</div>
										<div className="landing-stage-pips" aria-label="Canvas tour progress">
											{landingStoryChapters.map((chapter) => (
												<span
													key={chapter.id}
													data-active={chapter.id === progressChapterId ? 'true' : undefined}
													title={chapter.label}
												/>
											))}
										</div>
									</div>
								</div>
							</aside>

							<div className="landing-canvas-column">
								<LandingCanvasScene
									activeChapter={activeChapter}
									activeProgressChapterId={progressChapterId}
									boardStyle={boardStyle}
									chapters={landingStoryChapters}
									email={email}
									onEmailChange={(value) => {
										setEmail(value);
										if (waitlistStatus !== 'idle') {
											setWaitlistStatus('idle');
											setWaitlistMessage(null);
										}
									}}
									onWaitlistSubmit={(event) => {
										void handleWaitlistSubmit(event);
									}}
									waitlistMessage={waitlistMessage}
									waitlistStatus={waitlistStatus}
								/>
							</div>
						</div>
					</div>
				</section>

				<div className="landing-scroll-track" aria-hidden="true">
					{landingStoryChapters.map((chapter, index) => (
						<section
							key={chapter.id}
							id={chapter.id}
							ref={(node) => {
								sectionRefs.current[index] = node;
							}}
							className="landing-scroll-step"
							data-chapter-id={chapter.id}
						>
							<span>{chapter.label}</span>
						</section>
					))}
					<section
						id={landingWaitlistChapter.id}
						ref={waitlistRef}
						className="landing-scroll-step landing-scroll-step-final"
						data-chapter-id={landingWaitlistChapter.id}
					/>
				</div>
			</main>
		</div>
	);
}
