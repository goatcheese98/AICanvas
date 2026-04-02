import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type {
	PrototypeOverlayCustomData,
	PrototypeOverlayFile,
	PrototypeTemplate,
} from '@ai-canvas/shared/types';

export function getPrototypeStudioPath(canvasId: string, prototypeId: string) {
	return `/canvas/${canvasId}/prototype/${prototypeId}`;
}

function getPrototypeEntryPath(template: PrototypeTemplate) {
	return template === 'react' ? '/index.jsx' : '/index.js';
}

function getPrototypeStarterStyles() {
	return [
		'html, body, #root, #app { min-height: 100%; }',
		'body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #f8fafc; color: #0f172a; }',
		'.prototype-demo { min-height: 100vh; display: grid; place-items: center; padding: 40px; text-align: center; }',
		'.prototype-demo__card { max-width: 560px; border-radius: 28px; border: 1px solid rgba(15,23,42,0.08); background: white; padding: 32px; box-shadow: 0 24px 60px rgba(15,23,42,0.08); }',
		'.prototype-demo__eyebrow { margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #64748b; }',
		'.prototype-demo__title { margin: 0; font-size: 32px; line-height: 1.1; }',
		'.prototype-demo__copy { margin: 14px 0 0; font-size: 15px; line-height: 1.6; color: #475569; }',
	].join('\n');
}

function getPrototypeReactStarterCode() {
	return [
		"import React from 'react';",
		"import ReactDOM from 'react-dom/client';",
		"import './styles.css';",
		'',
		'function App() {',
		'	return (',
		'		<main className="prototype-demo">',
		'			<section className="prototype-demo__card">',
		'				<p className="prototype-demo__eyebrow">Prototype demo</p>',
		'				<h1 className="prototype-demo__title">Welcome to your prototype</h1>',
		'				<p className="prototype-demo__copy">',
		'					Edit this file or add new ones from the sidebar to explore the project.',
		'				</p>',
		'			</section>',
		'		</main>',
		'	);',
		'}',
		'',
		"const root = ReactDOM.createRoot(document.getElementById('root'));",
		'root.render(<App />);',
	].join('\n');
}

function getPrototypeVanillaStarterCode() {
	return [
		"import './styles.css';",
		'',
		'document.body.innerHTML = `',
		'	<main class="prototype-demo">',
		'		<section class="prototype-demo__card">',
		'			<p class="prototype-demo__eyebrow">Prototype demo</p>',
		'			<h1 class="prototype-demo__title">Welcome to your prototype</h1>',
		'			<p class="prototype-demo__copy">',
		'				Edit this file or add new ones from the sidebar to explore the project.',
		'			</p>',
		'		</section>',
		'	</main>',
		'`;',
	].join('\n');
}

function getPrototypeModuleStarterCode(path: string) {
	if (path.endsWith('.jsx') || path.endsWith('.tsx')) {
		return [
			'export default function Example() {',
			'	return <div className="prototype-demo__card">Add your component here.</div>;',
			'}',
		].join('\n');
	}

	if (path.endsWith('.js') || path.endsWith('.ts')) {
		return "export const example = 'Add your logic here';";
	}

	if (path.endsWith('.html')) {
		return [
			'<!doctype html>',
			'<html lang="en">',
			'  <head>',
			'    <meta charset="UTF-8" />',
			'    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
			'    <title>Prototype</title>',
			'  </head>',
			'  <body>',
			'    <div id="root"></div>',
			'  </body>',
			'</html>',
		].join('\n');
	}

	if (path.endsWith('.css')) {
		return getPrototypeStarterStyles();
	}

	if (path.endsWith('.json')) {
		return '{}';
	}

	return '';
}

export function getPrototypeStarterCode(path: string, template: PrototypeTemplate) {
	if (path === '/styles.css') {
		return getPrototypeStarterStyles();
	}

	if (path === getPrototypeEntryPath(template)) {
		return template === 'react' ? getPrototypeReactStarterCode() : getPrototypeVanillaStarterCode();
	}

	return getPrototypeModuleStarterCode(path);
}

function createPrototypeStarterFiles(template: PrototypeTemplate) {
	const entryPath = getPrototypeEntryPath(template);
	return {
		[entryPath]: {
			code: getPrototypeStarterCode(entryPath, template),
			active: true,
		},
		'/styles.css': {
			code: getPrototypeStarterCode('/styles.css', template),
		},
	} satisfies Record<string, PrototypeOverlayFile>;
}

export function ensurePrototypeStarterFiles(
	input: PrototypeOverlayCustomData,
): PrototypeOverlayCustomData {
	const normalized = normalizePrototypeOverlay(input);
	if (Object.keys(normalized.files).length > 0) {
		return normalized as PrototypeOverlayCustomData;
	}

	return normalizePrototypeOverlay({
		...normalized,
		files: createPrototypeStarterFiles(normalized.template),
		activeFile: getPrototypeEntryPath(normalized.template),
	}) as PrototypeOverlayCustomData;
}

export function serializePrototypeFiles(files: PrototypeOverlayCustomData['files']) {
	return JSON.stringify(
		Object.keys(files)
			.sort()
			.map((path) => [path, files[path]]),
	);
}

export function serializePrototypeState(input: PrototypeOverlayCustomData) {
	const normalized = normalizePrototypeOverlay(input);
	return JSON.stringify({
		title: normalized.title,
		template: normalized.template,
		activeFile: normalized.activeFile,
		dependencies: Object.keys(normalized.dependencies ?? {})
			.sort()
			.reduce<Record<string, string>>((result, name) => {
				result[name] = normalized.dependencies?.[name] ?? '';
				return result;
			}, {}),
		files: JSON.parse(serializePrototypeFiles(normalized.files)),
	});
}
