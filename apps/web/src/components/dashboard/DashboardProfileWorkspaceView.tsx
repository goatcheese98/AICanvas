import type { WorkspaceSettings } from './dashboard-profile-utils';
import { PanelHeader } from './DashboardProfilePanelHeader';
import { ToggleRow } from './DashboardProfileToggleRow';

interface WorkspaceSettingsViewProps {
	settings: WorkspaceSettings;
	onBack: () => void;
	onClose: () => void;
	onUpdateSettings: (updater: (current: WorkspaceSettings) => WorkspaceSettings) => void;
}

export function WorkspaceSettingsView({
	settings,
	onBack,
	onClose,
	onUpdateSettings,
}: WorkspaceSettingsViewProps) {
	const handleVisibilityChange = (visibility: 'private' | 'public') => {
		onUpdateSettings((current) => ({
			...current,
			defaultCanvasVisibility: visibility,
		}));
	};

	const handleToggleSharedCanvases = () => {
		onUpdateSettings((current) => ({
			...current,
			showSharedCanvases: !current.showSharedCanvases,
		}));
	};

	return (
		<>
			<PanelHeader
				title="Workspace settings"
				description="A couple of shared workspace defaults that are reasonable to manage from your profile menu."
				onBack={onBack}
				onClose={onClose}
			/>

			<div className="space-y-4 px-3 py-4">
				<div>
					<label className="mb-2 block px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
						Default sharing
					</label>
					<div className="grid gap-2">
						<button
							type="button"
							onClick={() => handleVisibilityChange('private')}
							className={`rounded-[14px] border px-4 py-3 text-left transition ${
								settings.defaultCanvasVisibility === 'private'
									? 'border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] text-[var(--color-accent-text)]'
									: 'border-[var(--color-border)] bg-white/80 text-[var(--color-text-primary)] hover:border-[var(--color-accent-border)]'
							}`}
						>
							<div className="text-sm font-semibold">Private first</div>
							<div className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
								New canvases stay personal until you intentionally share them.
							</div>
						</button>
						<button
							type="button"
							onClick={() => handleVisibilityChange('public')}
							className={`rounded-[14px] border px-4 py-3 text-left transition ${
								settings.defaultCanvasVisibility === 'public'
									? 'border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] text-[var(--color-accent-text)]'
									: 'border-[var(--color-border)] bg-white/80 text-[var(--color-text-primary)] hover:border-[var(--color-accent-border)]'
							}`}
						>
							<div className="text-sm font-semibold">Public by default</div>
							<div className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
								Useful if your canvases are mostly for demos, reviews, or open collaboration.
							</div>
						</button>
					</div>
				</div>

				<ToggleRow
					label="Show shared canvases in the library"
					description="Keep canvases from teammates visible alongside your own work."
					isEnabled={settings.showSharedCanvases}
					onToggle={handleToggleSharedCanvases}
				/>
			</div>
		</>
	);
}
