import { describe, expect, it } from 'vitest';
import { parsePrototypeArtifactContent } from './prototype-helpers';

describe('parsePrototypeArtifactContent', () => {
	it('accepts dependency arrays and string-valued file maps', () => {
		const result = parsePrototypeArtifactContent(
			JSON.stringify({
				title: 'Calculator App',
				template: 'react',
				activeFile: '/App.jsx',
				dependencies: ['react', 'react-dom/client', 'lucide-react'],
				preview: {
					eyebrow: 'Interactive Tool',
					title: 'Calculator',
					description: 'Compact calculator UI',
					accent: '#2563eb',
					background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
					badges: ['React'],
					metrics: [],
				},
				files: {
					'/index.jsx':
						'import { createRoot } from "react-dom/client";\nimport App from "./App.jsx";\ncreateRoot(document.getElementById("root")).render(<App />);',
					'/App.jsx': 'export default function App() { return <main>Calculator</main>; }',
				},
			}),
		);

		expect(result?.files['/index.jsx']?.code).toContain('createRoot');
		expect(result?.files['/App.jsx']?.code).toContain('Calculator');
		expect(Object.keys(result?.dependencies ?? {}).sort()).toEqual([
			'lucide-react',
			'react',
			'react-dom/client',
		]);
	});

	it('accepts file arrays and code stored under content', () => {
		const result = parsePrototypeArtifactContent(
			JSON.stringify({
				prototype: {
					title: 'Calculator App',
					template: 'react',
					activeFile: '/App.jsx',
					files: [
						{
							path: '/index.jsx',
							content:
								'import { createRoot } from "react-dom/client";\nimport App from "./App.jsx";\ncreateRoot(document.getElementById("root")).render(<App />);',
							hidden: true,
						},
						{
							path: '/App.jsx',
							content: 'export default function App() { return <main>Calculator</main>; }',
						},
					],
				},
			}),
		);

		expect(result?.files['/index.jsx']?.hidden).toBe(true);
		expect(result?.activeFile).toBe('/App.jsx');
		expect(result?.files['/App.jsx']?.code).toContain('Calculator');
	});

	it('extracts a JSON object from surrounding prose when needed', () => {
		const result = parsePrototypeArtifactContent(
			[
				'Here is the prototype JSON:',
				'{',
				'  "title": "Calculator App",',
				'  "template": "react",',
				'  "activeFile": "/App.jsx",',
				'  "files": {',
				'    "/index.jsx": { "code": "import App from \\"./App.jsx\\";" },',
				'    "/App.jsx": { "code": "export default function App() { return <main>Calculator</main>; }" }',
				'  }',
				'}',
				'Use it directly.',
			].join('\n'),
		);

		expect(result?.title).toBe('Calculator App');
		expect(result?.files['/App.jsx']?.code).toContain('Calculator');
	});
});
