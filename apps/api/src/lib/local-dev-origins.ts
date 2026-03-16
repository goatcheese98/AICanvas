const LOCAL_DEV_PORTS = ['5173', '5174', '5175', '5176'] as const;
const LOCAL_DEV_HOSTS = ['localhost', '127.0.0.1'] as const;

export const DEFAULT_LOCAL_DEV_ORIGINS = LOCAL_DEV_HOSTS.flatMap((host) =>
	LOCAL_DEV_PORTS.map((port) => `http://${host}:${port}`),
);

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

	return isProductionEnvironment(environment)
		? dedupeOrigins(configuredOrigins)
		: dedupeOrigins([...DEFAULT_LOCAL_DEV_ORIGINS, ...configuredOrigins]);
}

export function getAuthorizedParties(
	configuredPartiesValue: string | undefined,
	environment: string | undefined,
) {
	const configuredParties = parseOriginList(configuredPartiesValue);

	if (configuredParties.length === 0) {
		return [];
	}

	return isProductionEnvironment(environment)
		? dedupeOrigins(configuredParties)
		: dedupeOrigins([...DEFAULT_LOCAL_DEV_ORIGINS, ...configuredParties]);
}
