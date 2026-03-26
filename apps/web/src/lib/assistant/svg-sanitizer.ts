const BLOCKED_TAG_NAMES = new Set(['foreignobject', 'iframe', 'object', 'embed', 'script']);

function isSafeSvgUrl(value: string): boolean {
	const normalized = value.trim();
	if (!normalized) return true;
	if (
		normalized.startsWith('#') ||
		normalized.startsWith('/') ||
		normalized.startsWith('./') ||
		normalized.startsWith('../')
	) {
		return true;
	}

	if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized)) {
		return true;
	}

	try {
		const url = new URL(normalized, 'https://roopstudio.com');
		return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
	} catch {
		return false;
	}
}

function sanitizeSvgElement(element: Element): void {
	for (const child of [...element.children]) {
		if (BLOCKED_TAG_NAMES.has(child.tagName.toLowerCase())) {
			child.remove();
			continue;
		}

		sanitizeSvgElement(child);
	}

	for (const attribute of [...element.attributes]) {
		const name = attribute.name.toLowerCase();
		const value = attribute.value;

		if (name.startsWith('on')) {
			element.removeAttribute(attribute.name);
			continue;
		}

		if ((name === 'href' || name === 'xlink:href' || name === 'src') && !isSafeSvgUrl(value)) {
			element.removeAttribute(attribute.name);
			continue;
		}

		if (name === 'style' && /(javascript:|expression\s*\()/i.test(value)) {
			element.removeAttribute(attribute.name);
		}
	}
}

export function sanitizeSvgMarkup(svgMarkup: string): string {
	if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
		return svgMarkup;
	}

	const document = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
	const svg = document.documentElement;

	if (!svg || svg.tagName.toLowerCase() !== 'svg') {
		throw new Error('Invalid SVG markup');
	}

	sanitizeSvgElement(svg);
	return new XMLSerializer().serializeToString(svg);
}
