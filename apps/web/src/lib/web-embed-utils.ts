const EMBED_PATTERNS = [
	{
		pattern:
			/(?:(?:youtube\.com\/watch\?v=)|(?:youtu\.be\/)|(?:youtube\.com\/embed\/)|(?:youtube\.com\/v\/)|(?:youtube\.com\/shorts\/))([a-zA-Z0-9_-]+)/,
		convert: (id: string) => `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`,
	},
	{
		pattern: /^https?:\/\/(?:www\.)?youtube\.com\/?$/,
		convert: () => null,
	},
	{
		pattern: /vimeo\.com\/(\d+)/,
		convert: (id: string) => `https://player.vimeo.com/video/${id}`,
	},
	{
		pattern: /figma\.com\/file\/([a-zA-Z0-9]+)/,
		convert: (id: string) =>
			`https://www.figma.com/embed?embed_host=ai-canvas&url=https://www.figma.com/file/${id}`,
	},
	{
		pattern: /codepen\.io\/([^/]+)\/pen\/([^/]+)/,
		convert: (user: string, pen: string) => `https://codepen.io/${user}/embed/${pen}`,
	},
	{
		pattern: /stackblitz\.com\/edit\/([^?]+)/,
		convert: (project: string) => `https://stackblitz.com/edit/${project}?embed=1`,
	},
	{
		pattern: /open\.spotify\.com\/(playlist|album|track|artist|show|episode)\/([a-zA-Z0-9]+)/,
		convert: (resourceType: string, id: string) =>
			`https://open.spotify.com/embed/${resourceType}/${id}`,
	},
	{
		pattern: /docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/,
		convert: (type: string, id: string) => `https://docs.google.com/${type}/d/${id}/preview`,
	},
	{
		pattern: /(?:en\.)?wikipedia\.org\/wiki\/(.+)/,
		convert: (article: string) => `https://en.m.wikipedia.org/wiki/${article}`,
	},
	{
		pattern: /(?:en\.)?m\.wikipedia\.org\/wiki\/(.+)/,
		convert: (article: string) => `https://en.m.wikipedia.org/wiki/${article}`,
	},
	{
		pattern: /excalidraw\.com\/\?library=([^&]+)/,
		convert: (library: string) => `https://excalidraw.com/?library=${library}`,
	},
] as const;

function extractGoogleMapsQuery(url: URL): string | null {
	const query = url.searchParams.get('q') || url.searchParams.get('query');
	if (query) {
		return query;
	}

	const pathMatch = url.pathname.match(/\/maps\/(?:place|search)\/([^/]+)/i);
	if (!pathMatch?.[1]) {
		return null;
	}

	return decodeURIComponent(pathMatch[1]).replace(/\+/g, ' ');
}

function convertGoogleMapsUrlToEmbedUrl(url: string): string | null {
	const mapsEmbedApiKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY?.trim();
	if (!mapsEmbedApiKey) {
		return null;
	}

	try {
		const parsed = new URL(url);
		const isGoogleMapsHost =
			parsed.hostname.includes('google.com') || parsed.hostname.includes('google.ca');
		if (!isGoogleMapsHost || !parsed.pathname.startsWith('/maps')) {
			return null;
		}

		const query = extractGoogleMapsQuery(parsed);
		if (!query) {
			return null;
		}

		return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsEmbedApiKey)}&q=${encodeURIComponent(query)}`;
	} catch {
		return null;
	}
}

export function convertToEmbedUrl(url: string): string | null {
	const googleMapsEmbedUrl = convertGoogleMapsUrlToEmbedUrl(url);
	if (googleMapsEmbedUrl) {
		return googleMapsEmbedUrl;
	}

	for (const { pattern, convert } of EMBED_PATTERNS) {
		const match = url.match(pattern);
		if (!match) continue;
		const converted = (convert as (...args: string[]) => string | null)(...match.slice(1));
		if (converted !== null) return converted;
	}

	return null;
}

export function getMicrolinkApiUrl(url: string): string {
	const apiUrl = new URL('https://api.microlink.io/');
	apiUrl.searchParams.set('url', url);
	apiUrl.searchParams.set('screenshot', 'true');
	return apiUrl.toString();
}

export function isKnownEmbeddable(url: string): boolean {
	try {
		const hostname = new URL(url).hostname.toLowerCase();

		const embeddableDomains = [
			'vimeo.com',
			'figma.com',
			'codepen.io',
			'stackblitz.com',
			'docs.google.com',
			'm.wikipedia.org',
			'excalidraw.com',
			'wikipedia.org',
			'wikimedia.org',
			'archive.org',
			'replit.com',
			'glitch.com',
			'observablehq.com',
			'notion.site',
			'loom.com',
			'canva.com',
			'spotify.com',
		];

		if (hostname.includes('google.com') && url.includes('/maps/embed/')) {
			return true;
		}

		if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
			return url.includes('/embed/') || url.includes('/watch?v=') || url.includes('youtu.be/');
		}

		return embeddableDomains.some((domain) => hostname.includes(domain));
	} catch {
		return false;
	}
}

export function enhanceUrl(input: string): {
	url: string;
	isSearch: boolean;
	embedUrl?: string;
	warning?: string;
} {
	let url = input.trim();

	if (!url) return { url: '', isSearch: false };

	const isSearch = !url.includes('.') || url.includes(' ');
	if (isSearch) {
		const searchQuery = encodeURIComponent(url);
		return {
			url: `https://www.google.com/search?q=${searchQuery}`,
			isSearch: true,
			warning:
				"Search queries don't embed in iframes. Paste a direct page URL, or open the search in a new tab.",
		};
	}

	if (!url.match(/^https?:\/\//i)) {
		url = `https://${url}`;
	}

	if (url.match(/^(javascript|data|vbscript|file|ftp):/i)) {
		return { url: '', isSearch: false };
	}

	try {
		const parsed = new URL(url);
		const isGoogleMapsUrl =
			(parsed.hostname.includes('google.com') || parsed.hostname.includes('google.ca')) &&
			parsed.pathname.startsWith('/maps');
		if (isGoogleMapsUrl && !import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY?.trim()) {
			return {
				url,
				isSearch: false,
				warning:
					'Google Maps links need VITE_GOOGLE_MAPS_EMBED_API_KEY configured to use Google’s official embed URL.',
			};
		}
	} catch {
		return { url: '', isSearch: false };
	}

	const embedUrl = convertToEmbedUrl(url);
	return { url, isSearch: false, embedUrl: embedUrl ?? undefined };
}
