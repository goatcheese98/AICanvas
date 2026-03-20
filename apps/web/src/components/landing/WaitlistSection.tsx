import type { FormEventHandler } from 'react';

type WaitlistSectionProps = {
	email: string;
	waitlistMessage: string | null;
	waitlistStatus: 'idle' | 'submitting' | 'success' | 'error';
	onEmailChange: (value: string) => void;
	onWaitlistSubmit: FormEventHandler<HTMLFormElement>;
	active: boolean;
};

export function WaitlistSection({
	email,
	waitlistMessage,
	waitlistStatus,
	onEmailChange,
	onWaitlistSubmit,
	active,
}: WaitlistSectionProps) {
	return (
		<form
			aria-label="Landing waitlist form"
			className="landing-board-card landing-board-waitlist-card"
			data-chapter="waitlist"
			data-active={active ? 'true' : undefined}
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
	);
}
