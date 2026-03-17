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

const BLOCKED_SITES = [
	{
		domain: 'google.com',
		message:
			"Google doesn't allow its pages to be previewed here. Use a direct embeddable page URL or open in a new tab.",
	},
	{
		domain: 'youtube.com',
		message: "YouTube homepages can't be previewed here. Try pasting a specific video URL instead.",
	},
	{
		domain: 'facebook.com',
		message: "Facebook doesn't allow its pages to be previewed here. Open it in a new tab instead.",
	},
	{
		domain: 'twitter.com',
		message:
			"X (Twitter) doesn't allow its pages to be previewed here. Open it in a new tab instead.",
	},
	{
		domain: 'x.com',
		message:
			"X (Twitter) doesn't allow its pages to be previewed here. Open it in a new tab instead.",
	},
	{
		domain: 'instagram.com',
		message:
			"Instagram doesn't allow its pages to be previewed here. Open it in a new tab instead.",
	},
	{
		domain: 'linkedin.com',
		message: "LinkedIn doesn't allow its pages to be previewed here. Open it in a new tab instead.",
	},
	{
		domain: 'reddit.com',
		message: "Reddit doesn't allow its pages to be previewed here. Open it in a new tab instead.",
	},
] as const;

export function convertToEmbedUrl(url: string): string | null {
	for (const { pattern, convert } of EMBED_PATTERNS) {
		const match = url.match(pattern);
		if (!match) continue;
		const converted = (convert as (...args: string[]) => string | null)(...match.slice(1));
		if (converted !== null) return converted;
	}

	return null;
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
		];

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
		const blocked = BLOCKED_SITES.find((site) => parsed.hostname.includes(site.domain));

		if (blocked?.domain === 'youtube.com') {
			if (!url.includes('/watch?v=') && !url.includes('/embed/') && !url.includes('youtu.be/')) {
				return { url, isSearch: false, warning: blocked.message };
			}
		} else if (blocked?.domain === 'google.com') {
			if (!url.includes('/search?')) {
				return { url, isSearch: false, warning: blocked.message };
			}
		} else if (blocked) {
			return { url, isSearch: false, warning: blocked.message };
		}
	} catch {
		return { url: '', isSearch: false };
	}

	const embedUrl = convertToEmbedUrl(url);
	return { url, isSearch: false, embedUrl: embedUrl ?? undefined };
}
