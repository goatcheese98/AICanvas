import { useClerk } from '@clerk/clerk-react';
import { MenuAction } from './DashboardProfileMenuAction';
import { UserInfo } from './DashboardProfileUserInfo';
import type { ActiveView } from './dashboard-profile-utils';

interface MenuContentProps {
	displayName: string;
	email: string;
	imageUrl: string | null | undefined;
	initials: string;
	onClose: () => void;
	onNavigate: (view: ActiveView) => void;
}

export function MenuContent({
	displayName,
	email,
	imageUrl,
	initials,
	onClose,
	onNavigate,
}: MenuContentProps) {
	const { redirectToUserProfile, signOut } = useClerk();

	const handleManageAccount = () => {
		onClose();
		void redirectToUserProfile();
	};

	const handleSignOut = () => {
		void signOut();
	};

	return (
		<>
			<UserInfo
				displayName={displayName}
				email={email}
				imageUrl={imageUrl}
				initials={initials}
				onClose={onClose}
			/>

			<div className="px-2 pb-2 pt-3">
				<div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
					Account
				</div>

				<div className="space-y-1">
					<MenuAction
						label="Manage account"
						description="Update your profile, password, and connected sign-in methods."
						onClick={handleManageAccount}
					/>
					<MenuAction
						label="Workspace settings"
						description="Choose your default canvas sharing mode and library behavior."
						onClick={() => onNavigate('workspace')}
					/>
					<MenuAction
						label="Preferences"
						description="Adjust personal dashboard preferences without leaving this page."
						onClick={() => onNavigate('preferences')}
					/>
				</div>
			</div>

			<div className="border-t border-[var(--color-border)] px-2 py-2">
				<button
					type="button"
					onClick={handleSignOut}
					className="flex w-full items-start rounded-[12px] px-3 py-3 text-left transition hover:bg-[var(--color-danger-bg)]"
				>
					<div>
						<div className="text-sm font-semibold text-[var(--color-danger-text)]">Sign out</div>
						<div className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
							End this session and return to the sign-in screen.
						</div>
					</div>
				</button>
			</div>
		</>
	);
}
