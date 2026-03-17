import type { AuthUser } from '../../types';

interface ClerkEmailAddressLike {
	emailAddress?: string | null;
}

interface ClerkUserLike {
	id: string;
	firstName?: string | null;
	lastName?: string | null;
	username?: string | null;
	imageUrl?: string | null;
	emailAddresses?: ClerkEmailAddressLike[];
}

export function buildAuthUser(user: ClerkUserLike): AuthUser {
	const email =
		user.emailAddresses?.find(
			(candidate) =>
				typeof candidate.emailAddress === 'string' && candidate.emailAddress.length > 0,
		)?.emailAddress ?? `${user.id}@clerk.local`;
	const name =
		`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
		user.username?.trim() ||
		'Unnamed User';

	return {
		id: user.id,
		email,
		name,
		avatarUrl: user.imageUrl ?? undefined,
	};
}
