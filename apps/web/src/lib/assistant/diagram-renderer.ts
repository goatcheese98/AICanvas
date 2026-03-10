export type D2RenderVariant = 'default' | 'sketch' | 'ascii';

export interface DiagramSvgRenderResult {
	svgMarkup: string;
	width: number;
	height: number;
}

type D2Engine = {
	compile: (input: unknown, options?: unknown) => Promise<{
		diagram: unknown;
		renderOptions: unknown;
	}>;
	render: (diagram: unknown, options?: unknown) => Promise<string>;
};

let d2EnginePromise: Promise<D2Engine> | undefined;

async function getD2Engine(): Promise<D2Engine> {
	if (!d2EnginePromise) {
		d2EnginePromise = import('@terrastruct/d2').then((mod) => {
			const engine = new mod.D2();
			return {
				compile: engine.compile.bind(engine) as D2Engine['compile'],
				render: engine.render.bind(engine) as D2Engine['render'],
			};
		});
	}

	try {
		return await d2EnginePromise;
	} catch (error) {
		d2EnginePromise = undefined;
		throw error;
	}
}

function toSceneCompatibleElements(elements: unknown[]): any[] {
	return (elements as Array<Record<string, any>>).map((raw) => {
		const element = raw ?? {};
		const isText = element.type === 'text';
		const textValue = typeof element.text === 'string' ? element.text : '';
		const fontSize = typeof element.fontSize === 'number' ? element.fontSize : 20;
		const fallbackTextWidth = Math.max(
			16,
			Math.round(textValue.length * Math.max(10, fontSize * 0.58)),
		);
		const fallbackTextHeight = Math.max(16, Math.round(fontSize * 1.25));
		const width =
			typeof element.width === 'number' && element.width > 0
				? element.width
				: isText
					? fallbackTextWidth
					: 100;
		const height =
			typeof element.height === 'number' && element.height > 0
				? element.height
				: isText
					? fallbackTextHeight
					: 100;
		const normalized: Record<string, unknown> = {
			type: element.type ?? 'rectangle',
			x: element.x ?? 0,
			y: element.y ?? 0,
			width,
			height,
			id: element.id ?? `diagram_${Math.random().toString(36).slice(2, 10)}`,
			angle: element.angle ?? 0,
			strokeColor: element.strokeColor ?? (isText ? '#111827' : '#000000'),
			backgroundColor: element.backgroundColor ?? 'transparent',
			fillStyle: element.fillStyle ?? (isText ? 'solid' : 'hachure'),
			strokeWidth: element.strokeWidth ?? 1,
			strokeStyle: element.strokeStyle ?? 'solid',
			roughness: element.roughness ?? (isText ? 0 : 1),
			opacity: element.opacity ?? 100,
			roundness: element.roundness ?? null,
			seed: element.seed ?? Math.floor(Math.random() * 100000),
			version: element.version ?? 1,
			versionNonce: element.versionNonce ?? Date.now(),
			isDeleted: element.isDeleted ?? false,
			groupIds: Array.isArray(element.groupIds) ? element.groupIds : [],
			frameId: element.frameId ?? null,
			boundElements: element.boundElements ?? null,
			updated: element.updated ?? Date.now(),
			link: element.link ?? null,
			locked: element.locked ?? false,
		};

		if (isText) {
			normalized.text = textValue;
			normalized.originalText =
				typeof element.originalText === 'string' ? element.originalText : textValue;
			normalized.fontSize = fontSize;
			normalized.fontFamily =
				typeof element.fontFamily === 'number' ? element.fontFamily : 3;
			normalized.textAlign = element.textAlign ?? 'left';
			normalized.verticalAlign = element.verticalAlign ?? 'top';
			normalized.lineHeight =
				typeof element.lineHeight === 'number' ? element.lineHeight : 1.25;
			normalized.baseline =
				typeof element.baseline === 'number' ? element.baseline : Math.round(fontSize * 1.2);
			normalized.containerId = element.containerId ?? null;
		} else {
			if (typeof element.text === 'string') normalized.text = element.text;
			if (typeof element.fontSize === 'number') normalized.fontSize = element.fontSize;
			if (typeof element.fontFamily === 'number') normalized.fontFamily = element.fontFamily;
		}

		if (Array.isArray(element.points)) normalized.points = element.points;
		if (typeof element.endArrowhead !== 'undefined') normalized.endArrowhead = element.endArrowhead;
		if (typeof element.startArrowhead !== 'undefined') normalized.startArrowhead = element.startArrowhead;
		if (typeof element.customData === 'object' && element.customData !== null) {
			normalized.customData = element.customData;
		}

		return normalized;
	});
}

async function exportElementsToSvgMarkup(
	elements: unknown[],
	files?: Record<string, unknown>,
): Promise<string> {
	const { exportToSvg, convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
	const normalized = convertToExcalidrawElements(toSceneCompatibleElements(elements) as any);

	if (normalized.length === 0) {
		throw new Error('No drawable elements were generated');
	}

	const svg = await exportToSvg({
		elements: normalized,
		appState: {
			exportBackground: true,
			exportWithDarkMode: false,
			viewBackgroundColor: '#ffffff',
		} as any,
		files: files ?? {},
	});

	if (!svg?.outerHTML) {
		throw new Error('Failed to render SVG');
	}

	return svg.outerHTML;
}

function escapeSvgText(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function asciiFromD2(source: string): string {
	const lines = source
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith('#'));

	const nodes = new Map<string, string>();
	const edges: Array<{ from: string; to: string; label?: string }> = [];

	for (const line of lines) {
		const edgeMatch = line.match(
			/^([a-zA-Z0-9_-]+)\s*->\s*([a-zA-Z0-9_-]+)(?:\s*:\s*(.+))?$/,
		);
		if (edgeMatch) {
			const from = edgeMatch[1];
			const to = edgeMatch[2];
			const label = edgeMatch[3]?.replace(/^"|"$/g, '').trim();
			if (!nodes.has(from)) nodes.set(from, from);
			if (!nodes.has(to)) nodes.set(to, to);
			edges.push({ from, to, label });
			continue;
		}

		const nodeMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.+)$/);
		if (nodeMatch) {
			const id = nodeMatch[1];
			const label = nodeMatch[2].replace(/^"|"$/g, '').trim();
			nodes.set(id, label || id);
		}
	}

	const output: string[] = ['D2 ASCII Render', '==============', ''];
	if (nodes.size > 0) {
		output.push('Nodes:');
		for (const [id, label] of nodes.entries()) {
			output.push(`- ${id}: ${label}`);
		}
		output.push('');
	}

	if (edges.length > 0) {
		output.push('Edges:');
		for (const edge of edges) {
			output.push(`- ${edge.from} -> ${edge.to}${edge.label ? ` : ${edge.label}` : ''}`);
		}
	} else {
		output.push('No edges parsed.');
	}

	return output.join('\n');
}

export function asciiToSvg(ascii: string): string {
	const lines = ascii.split('\n');
	const maxChars = lines.reduce((max, line) => Math.max(max, line.length), 0);
	const fontSize = 14;
	const lineHeight = 20;
	const padding = 16;
	const width = Math.max(280, maxChars * 8 + padding * 2);
	const height = Math.max(180, lines.length * lineHeight + padding * 2);
	const tspans = lines
		.map(
			(line, index) =>
				`<tspan x="${padding}" y="${padding + fontSize + index * lineHeight}">${escapeSvgText(line)}</tspan>`,
		)
		.join('');

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
		'<rect width="100%" height="100%" fill="#ffffff"/>',
		`<text font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="${fontSize}" fill="#0f172a">${tspans}</text>`,
		'</svg>',
	].join('');
}

async function renderD2WithEngine(source: string, variant: D2RenderVariant): Promise<string> {
	const d2 = await getD2Engine();
	const compileOptions = {
		layout: 'dagre',
		sketch: variant === 'sketch',
		ascii: variant === 'ascii',
		asciiMode: 'extended',
		themeID: 0,
	} as const;

	const result = await d2.compile({
		fs: { 'index.d2': source },
		inputPath: 'index.d2',
		options: compileOptions,
	});
	const renderOutput = await d2.render(result.diagram, result.renderOptions);

	if (variant === 'ascii') {
		return asciiToSvg(renderOutput);
	}

	return renderOutput;
}

export function parseSvgDimensions(svgMarkup: string): { width: number; height: number } {
	const finiteSize = (width: number, height: number) =>
		Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
			? { width, height }
			: null;

	if (typeof DOMParser !== 'undefined') {
		try {
			const document = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
			const svg = document.documentElement;
			if (svg?.tagName?.toLowerCase() === 'svg') {
				const viewBox = svg.getAttribute('viewBox');
				if (viewBox) {
					const parts = viewBox
						.trim()
						.split(/[\s,]+/)
						.map((part) => Number(part));
					if (parts.length === 4) {
						const size = finiteSize(parts[2], parts[3]);
						if (size) return size;
					}
				}

				const widthAttr = svg.getAttribute('width');
				const heightAttr = svg.getAttribute('height');
				const size = finiteSize(
					widthAttr ? Number.parseFloat(widthAttr) : Number.NaN,
					heightAttr ? Number.parseFloat(heightAttr) : Number.NaN,
				);
				if (size) return size;
			}
		} catch {
			// Fall through to regex parsing.
		}
	}

	const svgTagMatch = svgMarkup.match(/<svg\b[^>]*>/i);
	if (svgTagMatch) {
		const svgTag = svgTagMatch[0];
		const viewBoxMatch = svgTag.match(/viewBox=(["'])([^"']+)\1/i);
		if (viewBoxMatch) {
			const parts = viewBoxMatch[2]
				.trim()
				.split(/[\s,]+/)
				.map((part) => Number(part));
			if (parts.length === 4) {
				const size = finiteSize(parts[2], parts[3]);
				if (size) return size;
			}
		}

		const widthMatch = svgTag.match(/\bwidth=(["'])([^"']+)\1/i);
		const heightMatch = svgTag.match(/\bheight=(["'])([^"']+)\1/i);
		const size = finiteSize(
			widthMatch ? Number.parseFloat(widthMatch[2]) : Number.NaN,
			heightMatch ? Number.parseFloat(heightMatch[2]) : Number.NaN,
		);
		if (size) return size;
	}

	return { width: 1200, height: 900 };
}

export async function renderCodeArtifactToSvg(input: {
	language: 'mermaid' | 'd2';
	code: string;
	d2Variant?: D2RenderVariant;
}): Promise<DiagramSvgRenderResult> {
	if (input.language === 'mermaid') {
		const { renderMermaidToSvg } = await import('@/lib/assistant/mermaid-converter');
		const svgMarkup = await renderMermaidToSvg(input.code);
		return {
			svgMarkup,
			...parseSvgDimensions(svgMarkup),
		};
	}

	const d2Variant = input.d2Variant ?? 'default';
	try {
		const svgMarkup = await renderD2WithEngine(input.code, d2Variant);
		return {
			svgMarkup,
			...parseSvgDimensions(svgMarkup),
		};
	} catch (error) {
		if (d2Variant === 'ascii') {
			const svgMarkup = asciiToSvg(asciiFromD2(input.code));
			return {
				svgMarkup,
				...parseSvgDimensions(svgMarkup),
			};
		}

		throw (error instanceof Error ? error : new Error('D2 render failed'));
	}
}

function encodeSvgToBase64(svgMarkup: string): string | null {
	if (typeof btoa !== 'function' || typeof TextEncoder === 'undefined') {
		return null;
	}

	try {
		const bytes = new TextEncoder().encode(svgMarkup);
		let binary = '';
		const chunkSize = 0x8000;

		for (let offset = 0; offset < bytes.length; offset += chunkSize) {
			const chunk = bytes.subarray(offset, offset + chunkSize);
			binary += String.fromCharCode(...chunk);
		}

		return btoa(binary);
	} catch {
		return null;
	}
}

export function svgToDataUrl(svgMarkup: string): string {
	const base64 = encodeSvgToBase64(svgMarkup);
	if (base64) {
		return `data:image/svg+xml;base64,${base64}`;
	}

	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
}

export async function svgToPngBlob(
	svgMarkup: string,
	width: number,
	height: number,
): Promise<Blob> {
	const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml' });
	const svgUrl = URL.createObjectURL(svgBlob);

	try {
		const image = await new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('Failed to load SVG for PNG conversion'));
			img.src = svgUrl;
		});

		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(width));
		canvas.height = Math.max(1, Math.round(height));
		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Canvas context is unavailable');
		}

		context.fillStyle = '#ffffff';
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.drawImage(image, 0, 0, canvas.width, canvas.height);

		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, 'image/png');
		});
		if (!blob) {
			throw new Error('Failed to convert SVG to PNG');
		}

		return blob;
	} finally {
		URL.revokeObjectURL(svgUrl);
	}
}

export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
