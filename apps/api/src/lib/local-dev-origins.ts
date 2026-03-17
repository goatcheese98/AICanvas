export const DEFAULT_LOCAL_DEV_ORIGINS = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
];

export const DEFAULT_PUBLIC_ORIGINS = ['https://roopstudio.com', 'https://www.roopstudio.com'];

function dedupeOrigins(origins: string[]) {
	return [...new Set(origins)];
}

function isProductionEnvironment(environment: string | undefined) {
	return environment === 'production';
}

export function parseOriginList(value: string | undefined) {
	return (value ?? '')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
}

export function getCorsAllowedOrigins(
	configuredOriginsValue: string | undefined,
	environment: string | undefined,
) {
	const configuredOrigins = parseOriginList(configuredOriginsValue);

	if (configuredOrigins.length === 0) {
		return isProductionEnvironment(environment)
			? DEFAULT_PUBLIC_ORIGINS
			: [...DEFAULT_LOCAL_DEV_ORIGINS, ...DEFAULT_PUBLIC_ORIGINS];
	}

	return dedupeOrigins(configuredOrigins);
}

export function getAuthorizedParties(
	configuredPartiesValue: string | undefined,
	environment: string | undefined,
) {
	const configuredParties = parseOriginList(configuredPartiesValue);

	if (configuredParties.length === 0) {
		return [];
	}

	return dedupeOrigins(configuredParties);
}
