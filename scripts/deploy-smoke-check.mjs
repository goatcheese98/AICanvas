const DEFAULT_TIMEOUT_MS = 15000;

function requireEnv(name) {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

function trimTrailingSlash(value) {
	return value.replace(/\/+$/, '');
}

function normalizeHost(value) {
	const trimmed = value.trim();

	try {
		const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
		return url.host;
	} catch {
		return trimmed.replace(/\/+$/, '');
	}
}

async function fetchWithTimeout(url, init = {}) {
	return fetch(url, {
		...init,
		signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
	});
}

async function assertHttpOk(label, url) {
	const response = await fetchWithTimeout(url, { redirect: 'follow' });
	if (!response.ok) {
		throw new Error(
			`${label} check failed with ${response.status} ${response.statusText} for ${url}`,
		);
	}
	console.log(`PASS ${label}: ${url}`);
}

async function assertApiHealth(apiBaseUrl) {
	const url = `${trimTrailingSlash(apiBaseUrl)}/api/health`;
	const response = await fetchWithTimeout(url);

	if (!response.ok) {
		throw new Error(`API health check failed with ${response.status} ${response.statusText}`);
	}

	const payload = await response.json();
	if (payload?.status !== 'ok') {
		throw new Error(`API health response was not ok: ${JSON.stringify(payload)}`);
	}

	console.log(`PASS api health: ${url}`);
}

async function assertPartykit(host) {
	const normalizedHost = normalizeHost(host);
	const protocol =
		normalizedHost.startsWith('localhost') || normalizedHost.startsWith('127.0.0.1') ? 'ws' : 'wss';
	const roomId = `deploy-smoke-${Date.now()}`;
	const url = `${protocol}://${normalizedHost}/parties/main/${roomId}`;

	await new Promise((resolve, reject) => {
		const ws = new WebSocket(url);
		const timer = setTimeout(() => {
			ws.close();
			reject(new Error(`PartyKit smoke check timed out for ${url}`));
		}, DEFAULT_TIMEOUT_MS);

		ws.onerror = () => {
			clearTimeout(timer);
			reject(new Error(`PartyKit smoke check failed to connect to ${url}`));
		};

		ws.onmessage = (event) => {
			const payload = String(event.data ?? '');
			if (!payload.includes('"init-room"')) {
				return;
			}

			clearTimeout(timer);
			ws.close();
			console.log(`PASS partykit: ${url}`);
			resolve();
		};
	});
}

async function main() {
	const webUrl = requireEnv('DEPLOY_WEB_URL');
	const apiUrl = requireEnv('DEPLOY_API_URL');
	const partykitHost = process.env.DEPLOY_PARTYKIT_HOST?.trim();

	await assertHttpOk('web root', webUrl);
	await assertApiHealth(apiUrl);

	if (partykitHost) {
		await assertPartykit(partykitHost);
	} else {
		console.log('SKIP partykit: DEPLOY_PARTYKIT_HOST not provided');
	}
}

await main();
