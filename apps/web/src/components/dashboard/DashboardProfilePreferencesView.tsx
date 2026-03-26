import { PanelHeader } from './DashboardProfilePanelHeader';
import { ToggleRow } from './DashboardProfileToggleRow';
import type { PersonalPreferences } from './dashboard-profile-utils';

interface PreferencesViewProps {
	preferences: PersonalPreferences;
	onBack: () => void;
	onClose: () => void;
	onUpdatePreferences: (updater: (current: PersonalPreferences) => PersonalPreferences) => void;
}

export function PreferencesView({
	preferences,
	onBack,
	onClose,
	onUpdatePreferences,
}: PreferencesViewProps) {
	const handleToggleEmailDigests = () => {
		onUpdatePreferences((current) => ({
			...current,
			emailDigests: !current.emailDigests,
		}));
	};

	const handleToggleReducedMotion = () => {
		onUpdatePreferences((current) => ({
			...current,
			reducedMotion: !current.reducedMotion,
		}));
	};

	return (
		<>
			<PanelHeader
				title="Preferences"
				description="Personal dashboard settings that make sense to adjust quickly and back out of."
				onBack={onBack}
				onClose={onClose}
			/>

			<div className="space-y-4 px-3 py-4">
				<ToggleRow
					label="Email digests"
					description="Receive a summary when activity picks up across your canvases."
					isEnabled={preferences.emailDigests}
					onToggle={handleToggleEmailDigests}
				/>
				<ToggleRow
					label="Reduced motion"
					description="Tone down animated transitions when you want a steadier interface."
					isEnabled={preferences.reducedMotion}
					onToggle={handleToggleReducedMotion}
				/>
			</div>
		</>
	);
}
