import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateAssistantResponse, resolveGenerationMode } from './service';

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
});

describe('assistant service', () => {
	it('returns a chat response', async () => {
		const result = await generateAssistantResponse({
			message: 'help me scope this canvas',
			contextMode: 'all',
			generationMode: 'chat',
		});

		expect(result.message.role).toBe('assistant');
		expect(result.message.generationMode).toBe('chat');
		expect(result.message.content).toContain('whole-canvas');
	});

	it('returns reversible markdown patch artifacts for selected markdown edit requests', async () => {
		const result = await generateAssistantResponse({
			message:
				'I unfortunately do not have beef chuck or brisket. Can you adjust the list accordingly?',
			contextMode: 'selected',
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 1,
				selectedElementIds: ['note-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['markdown'],
				selectionSummary: [
					{
						id: 'note-1',
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
					},
				],
				selectedContexts: [
					{
						kind: 'markdown',
						id: 'note-1',
						priority: 1,
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
						markdown: {
							type: 'markdown',
							title: 'Notes',
							content: [
								'## Protein',
								'',
								'- [ ] Beef chuck',
								'- [ ] Brisket',
								'- [ ] Chicken thighs',
								'',
								'## Toppings',
								'',
								'- [ ] Jalapenos',
							].join('\n'),
						},
					},
				],
			},
		});

		const patch = JSON.parse(String(result.message.artifacts?.[0]?.content)) as {
			next: { content: string };
		};
		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'markdown-patch' });
		expect(result.message.content).toContain('Prepared reversible selection edits.');
		expect(result.message.artifacts?.[0]?.content).toContain('"kind": "markdown_patch"');
		expect(patch.next.content).not.toContain('Beef chuck');
		expect(patch.next.content).not.toContain('Brisket');
		expect(patch.next.content).toContain('Chicken thighs');
	});

	it('removes a named markdown section instead of parroting the prompt', async () => {
		const result = await generateAssistantResponse({
			message: 'Great. Can you actually remove the protein section from the grocery list?',
			contextMode: 'selected',
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 1,
				selectedElementIds: ['note-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['markdown'],
				selectionSummary: [
					{
						id: 'note-1',
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
					},
				],
				selectedContexts: [
					{
						kind: 'markdown',
						id: 'note-1',
						priority: 1,
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
						markdown: {
							type: 'markdown',
							title: 'Notes',
							content: [
								'## Protein',
								'',
								'- [ ] Chicken thighs',
								'',
								'## Toppings',
								'',
								'- [ ] Jalapenos',
							].join('\n'),
						},
					},
				],
			},
		});

		const patch = JSON.parse(String(result.message.artifacts?.[0]?.content)) as {
			next: { content: string };
		};
		expect(patch.next.content).not.toContain('## Protein');
		expect(patch.next.content).toContain('## Toppings');
		expect(patch.next.content).not.toContain('Great. Can you actually remove');
	});

	it('uses Anthropic to rewrite selected markdown when a valid full document is returned', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: ['```markdown', '## Toppings', '', '- [ ] Jalapenos', '```'].join('\n'),
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'remove the protein section',
			contextMode: 'selected',
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 1,
				selectedElementIds: ['note-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['markdown'],
				selectionSummary: [
					{
						id: 'note-1',
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
					},
				],
				selectedContexts: [
					{
						kind: 'markdown',
						id: 'note-1',
						priority: 1,
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
						markdown: {
							type: 'markdown',
							title: 'Notes',
							content: [
								'## Protein',
								'',
								'- [ ] Chicken thighs',
								'',
								'## Toppings',
								'',
								'- [ ] Jalapenos',
							].join('\n'),
						},
					},
				],
			},
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		const patch = JSON.parse(String(result.message.artifacts?.[0]?.content)) as {
			next: { content: string };
		};
		expect(patch.next.content).toBe('## Toppings\n\n- [ ] Jalapenos');
		expect(result.message.artifacts?.[0]?.content).toContain('Rewrites the selected markdown note');
	});

	it('falls back from Anthropic markdown rewrite when the model parrots the prompt', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: [
									'```markdown',
									'- Great. Can you actually remove the protein section from the grocery list?',
									'```',
								].join('\n'),
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'Great. Can you actually remove the protein section from the grocery list?',
			contextMode: 'selected',
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 1,
				selectedElementIds: ['note-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['markdown'],
				selectionSummary: [
					{
						id: 'note-1',
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
					},
				],
				selectedContexts: [
					{
						kind: 'markdown',
						id: 'note-1',
						priority: 1,
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
						markdown: {
							type: 'markdown',
							title: 'Notes',
							content: [
								'## Protein',
								'',
								'- [ ] Chicken thighs',
								'',
								'## Toppings',
								'',
								'- [ ] Jalapenos',
							].join('\n'),
						},
					},
				],
			},
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		const patch = JSON.parse(String(result.message.artifacts?.[0]?.content)) as {
			next: { content: string };
		};
		expect(patch.next.content).toContain('## Toppings');
		expect(patch.next.content).not.toContain('Great. Can you actually remove');
	});

	it('returns reversible kanban patch artifacts for selected kanban edit requests', async () => {
		const result = await generateAssistantResponse({
			message: 'add a QA follow-up task',
			contextMode: 'selected',
			generationMode: 'kanban',
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 1,
				selectedElementIds: ['board-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['kanban'],
				selectionSummary: [
					{
						id: 'board-1',
						elementType: 'rectangle',
						overlayType: 'kanban',
						label: 'Launch board',
					},
				],
				selectedContexts: [
					{
						kind: 'kanban',
						id: 'board-1',
						priority: 2,
						elementType: 'rectangle',
						overlayType: 'kanban',
						label: 'Launch board',
						kanban: {
							type: 'kanban',
							title: 'Launch board',
							columns: [{ id: 'todo', title: 'To Do', cards: [] }],
							bgTheme: 'parchment',
							fontId: 'excalifont',
							fontSize: 13,
						},
						kanbanSummary: {
							title: 'Launch board',
							columnCount: 1,
							cardCount: 0,
							emptyColumnCount: 1,
							cardsWithDescriptions: 0,
							overdueCardCount: 0,
							completedChecklistItemCount: 0,
							totalChecklistItemCount: 0,
							priorityCounts: { low: 0, medium: 0, high: 0 },
							labels: [],
							columns: [{ id: 'todo', title: 'To Do', cardCount: 0, cards: [] }],
						},
					},
				],
			},
		});

		expect(result.message.generationMode).toBe('kanban');
		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'kanban-patch' });
		expect(result.message.artifacts?.[0]?.content).toContain('"kind": "kanban_patch"');
	});

	it('returns Mermaid artifacts for Mermaid mode', async () => {
		const result = await generateAssistantResponse({
			message: 'design auth flow',
			contextMode: 'selected',
			generationMode: 'mermaid',
		});

		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'mermaid' });
		expect(result.message.content).toContain('```mermaid');
	});

	it('returns D2 artifacts for d2 mode', async () => {
		const result = await generateAssistantResponse({
			message: 'service dependencies',
			contextMode: 'all',
			generationMode: 'd2',
		});

		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'd2' });
		expect(result.message.content).toContain('```d2');
	});

	it('returns kanban operations for kanban mode', async () => {
		const result = await generateAssistantResponse({
			message: 'plan launch tasks',
			contextMode: 'all',
			generationMode: 'kanban',
		});

		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'kanban-ops' });
		expect(result.message.content).toContain('```json');
	});

	it('returns prototype files for prototype mode', async () => {
		const result = await generateAssistantResponse({
			message: 'build a prototype landing page for prompt workflows',
			contextMode: 'selected',
			generationMode: 'prototype',
		});

		expect(result.message.generationMode).toBe('prototype');
		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'prototype-files' });
		expect(result.message.content).toContain('Prepared prototype files');
		expect(result.message.artifacts?.[0]?.content).toContain('Blank prototype scaffold');
		expect(result.message.artifacts?.[0]?.content).toContain('/index.jsx');
		expect(result.message.artifacts?.[0]?.content).not.toContain('/App.jsx');
		expect(result.message.artifacts?.[0]?.content).not.toContain('PulseBoard');
	});

	it('builds a functional calculator app for calculator requests', async () => {
		const result = await generateAssistantResponse({
			message: 'Create a prototype calculator app',
			contextMode: 'selected',
			generationMode: 'prototype',
		});

		expect(result.message.artifacts?.[0]?.content).toContain('/components/CalculatorButton.jsx');
		expect(result.message.artifacts?.[0]?.content).toContain('evaluateExpression');
		expect(result.message.artifacts?.[0]?.content).toContain('container-type: inline-size');
		expect(result.message.artifacts?.[0]?.content).toContain('Expression Lab');
		expect(result.message.artifacts?.[0]?.content).toContain("label: '='");
		expect(result.message.artifacts?.[0]?.content).not.toContain('const overview = [');
		expect(result.message.artifacts?.[0]?.content).not.toContain('const tips = [');
		expect(result.message.artifacts?.[0]?.content).not.toContain('history.map((item)');
		expect(result.message.artifacts?.[0]?.content).not.toContain('Quick checks');
		expect(result.message.artifacts?.[0]?.content).not.toContain('Start Free');
		expect(result.message.artifacts?.[0]?.content).not.toContain('className="status-pill"');
	});

	it('builds a vanilla calculator app when requested', async () => {
		const result = await generateAssistantResponse({
			message: 'Create the prototype in Vanilla for a calculator app',
			contextMode: 'selected',
			generationMode: 'prototype',
		});

		expect(result.message.artifacts?.[0]?.content).toContain('"template": "vanilla"');
		expect(result.message.artifacts?.[0]?.content).toContain('/index.html');
		expect(result.message.artifacts?.[0]?.content).toContain('/index.js');
		expect(result.message.artifacts?.[0]?.content).toContain('container-type: inline-size');
		expect(result.message.artifacts?.[0]?.content).not.toContain('Start Free');
		expect(result.message.artifacts?.[0]?.content).not.toContain('>READY<');
	});

	it('strips prompt filler from calculator prototype titles', async () => {
		const result = await generateAssistantResponse({
			message: 'Please create calculator prototype',
			contextMode: 'selected',
			generationMode: 'prototype',
		});

		expect(result.message.artifacts?.[0]?.content).toContain('"title": "Calculator App"');
		expect(result.message.artifacts?.[0]?.content).not.toContain('Please Calculator App');
		expect(result.message.artifacts?.[0]?.content).toContain('Expression Lab');
	});

	it('truncates longer calculator titles so themed prompts do not fail schema validation', async () => {
		const result = await generateAssistantResponse({
			message: 'Can you create a prototype of a calculator theme like Pokemon.',
			contextMode: 'selected',
			generationMode: 'prototype',
		});
		const artifact = JSON.parse(String(result.message.artifacts?.[0]?.content)) as {
			title: string;
		};

		expect(result.message.generationMode).toBe('prototype');
		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'prototype-files' });
		expect(artifact.title.length).toBeLessThanOrEqual(32);
		expect(artifact.title.startsWith('Of ')).toBe(false);
	});

	it('builds a playable game prototype instead of a landing page for game requests', async () => {
		const result = await generateAssistantResponse({
			message: 'Create a tetris game prototype',
			contextMode: 'selected',
			generationMode: 'prototype',
		});

		expect(result.message.artifacts?.[0]?.content).toContain('"title": "Tetris Game"');
		expect(result.message.artifacts?.[0]?.content).toContain('Playable prototype');
		expect(result.message.artifacts?.[0]?.content).toContain('game-board');
		expect(result.message.artifacts?.[0]?.content).toContain('Arrow keys move');
		expect(result.message.artifacts?.[0]?.content).toContain('Hard Drop');
		expect(result.message.artifacts?.[0]?.content).toContain('lockPiece');
		expect(result.message.artifacts?.[0]?.content).toContain('useEffect');
		expect(result.message.artifacts?.[0]?.content).not.toContain('Conversion-ready website');
		expect(result.message.artifacts?.[0]?.content).not.toContain('Start Free');
		expect(result.message.artifacts?.[0]?.content).not.toContain('Book Demo');
	});

	it('keeps longer tetris app requests on the playable prototype path', async () => {
		const result = await generateAssistantResponse({
			message: 'Make an actual application for Tetris with the proper UI in your prototype.',
			contextMode: 'selected',
			generationMode: 'prototype',
		});

		expect(result.message.generationMode).toBe('prototype');
		expect(result.message.artifacts?.[0]?.content).toContain('"title": "Tetris Game"');
		expect(result.message.artifacts?.[0]?.content).toContain('"eyebrow": "Playable prototype"');
		expect(result.message.artifacts?.[0]?.content).toContain('game-board');
		expect(result.message.artifacts?.[0]?.content).toContain(
			'Game over. Press restart to play again.',
		);
		expect(result.message.artifacts?.[0]?.content).not.toContain('Would you like me to');
	});

	it('returns a reversible prototype patch for selected prototype edit requests', async () => {
		const result = await generateAssistantResponse({
			message: 'Can you actually turn this into an actual working demo?',
			contextMode: 'selected',
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 1,
				selectedElementIds: ['prototype-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['prototype'],
				selectionSummary: [
					{
						id: 'prototype-1',
						elementType: 'rectangle',
						overlayType: 'prototype',
						label: 'Tetris Game',
					},
				],
				selectedContexts: [
					{
						kind: 'prototype',
						id: 'prototype-1',
						priority: 1,
						elementType: 'rectangle',
						overlayType: 'prototype',
						label: 'Tetris Game',
						prototype: {
							title: 'Tetris Game',
							template: 'react',
							activeFile: '/App.jsx',
							filePaths: ['/App.jsx', '/index.jsx', '/styles.css'],
							dependencies: [],
						},
					},
				],
			},
			prototypeContext: {
				type: 'prototype',
				title: 'Tetris Game',
				template: 'react',
				activeFile: '/App.jsx',
				files: {
					'/App.jsx': { code: 'export default function App() { return <div>Placeholder</div>; }' },
					'/index.jsx': { code: "import { createRoot } from 'react-dom/client';", hidden: true },
					'/styles.css': { code: 'body { margin: 0; }' },
				},
			},
		});

		expect(result.message.generationMode).toBe('prototype');
		expect(result.message.content).toContain('Prepared reversible selection edits.');
		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'prototype-patch' });
		expect(result.message.artifacts?.[0]?.content).toContain('"kind": "prototype_patch"');
		expect(result.message.artifacts?.[0]?.content).toContain('"targetId": "prototype-1"');
		expect(result.message.artifacts?.[0]?.content).toContain('"title": "Tetris Game"');
		expect(result.message.artifacts?.[0]?.content).toContain('lockPiece');
	});

	it('infers a structured mode from a freeform request', async () => {
		expect(
			resolveGenerationMode({
				message: 'turn this selection into kanban tasks',
				contextMode: 'selected',
			}),
		).toBe('kanban');

		expect(
			resolveGenerationMode({
				message: 'build a prototype dashboard for this canvas',
				contextMode: 'selected',
			}),
		).toBe('prototype');

		expect(
			resolveGenerationMode({
				message: 'Create the propotype in Vanilla',
				contextMode: 'selected',
				prototypeContext: {
					type: 'prototype',
					title: 'Prototype',
					template: 'react',
					files: {},
					activeFile: '/App.jsx',
				},
			}),
		).toBe('prototype');

		expect(
			resolveGenerationMode({
				message: 'Can you actually turn this into an actual working demo?',
				contextMode: 'selected',
				prototypeContext: {
					type: 'prototype',
					title: 'Tetris Game',
					template: 'react',
					files: {},
					activeFile: '/App.jsx',
				},
			}),
		).toBe('prototype');

		expect(
			resolveGenerationMode({
				message: 'Can you create an image of a beautiful landing page?',
				contextMode: 'selected',
			}),
		).toBe('image');

		expect(
			resolveGenerationMode({
				message: 'Create a vectorizable mascot logo for this idea',
				contextMode: 'selected',
			}),
		).toBe('svg');

		expect(
			resolveGenerationMode({
				message: 'creat an image of dog',
				contextMode: 'selected',
			}),
		).toBe('image');

		const result = await generateAssistantResponse({
			message: 'diagram the auth flow for this canvas',
			contextMode: 'all',
		});

		expect(result.message.generationMode).toBe('mermaid');
		expect(result.message.content).toContain('```mermaid');
	});

	it('inherits the last diagram mode for follow-up edit requests', () => {
		expect(
			resolveGenerationMode({
				message: 'One of the arrows seems to be facing in a weird direction. Please fix.',
				contextMode: 'selected',
				history: [
					{
						id: 'assistant-1',
						role: 'assistant',
						content: '```d2\na -> b\n```',
						generationMode: 'd2',
						artifacts: [{ type: 'd2', content: 'a -> b' }],
						createdAt: new Date().toISOString(),
					},
				],
			}),
		).toBe('d2');
	});

	it('keeps image follow-ups on the image generation path', () => {
		expect(
			resolveGenerationMode({
				message: 'I would like there to be a better background for this',
				contextMode: 'selected',
				history: [
					{
						id: 'assistant-image-1',
						role: 'assistant',
						content: 'Generated image preview',
						generationMode: 'image',
						artifacts: [
							{
								type: 'image',
								content: JSON.stringify({
									kind: 'stored_asset',
									r2Key: 'assistant-assets/run-1/pelican.png',
									mimeType: 'image/png',
									provider: 'cloudflare',
									prompt:
										'Create a polished image for: Can you create an image of a pelican riding a bicycle?',
								}),
							},
						],
						createdAt: new Date().toISOString(),
					},
				],
			}),
		).toBe('image');

		expect(
			resolveGenerationMode({
				message: "Let's do it with a beach boardwalk combo.",
				contextMode: 'selected',
				history: [
					{
						id: 'assistant-image-1',
						role: 'assistant',
						content: 'Generated image preview',
						generationMode: 'image',
						artifacts: [
							{
								type: 'image',
								content: JSON.stringify({
									kind: 'stored_asset',
									r2Key: 'assistant-assets/run-1/pelican.png',
									mimeType: 'image/png',
									provider: 'cloudflare',
									prompt:
										'Create a polished image for: Can you create an image of a pelican riding a bicycle?',
								}),
							},
						],
						createdAt: new Date().toISOString(),
					},
				],
			}),
		).toBe('image');
	});

	it('keeps svg follow-ups on the svg path', () => {
		expect(
			resolveGenerationMode({
				message: 'make the ears bigger and simplify the shapes',
				contextMode: 'selected',
				history: [
					{
						id: 'assistant-svg-1',
						role: 'assistant',
						content: [
							'Prepared an SVG illustration draft.',
							'',
							'```svg',
							'<svg></svg>',
							'```',
						].join('\n'),
						generationMode: 'svg',
						createdAt: new Date().toISOString(),
					},
				],
			}),
		).toBe('svg');
	});

	it('builds diagram edit prompts from the previous diagram source', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: '```d2\na -> c\n```',
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'Okay, can you render it?',
			contextMode: 'selected',
			history: [
				{
					id: 'assistant-1',
					role: 'assistant',
					content: 'Generated a D2 diagram draft:\n\n```d2\na -> b\n```',
					generationMode: 'd2',
					artifacts: [{ type: 'd2', content: 'a -> b' }],
					createdAt: new Date().toISOString(),
				},
			],
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		expect(result.message.generationMode).toBe('d2');
		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'd2', content: 'a -> c' });

		const init = (fetchMock.mock.calls.at(0) as unknown[] | undefined)?.at(1) as
			| RequestInit
			| undefined;
		const body = JSON.parse(String(init?.body));
		expect(body.messages.at(-1)?.content).toContain('Current D2 source:');
		expect(body.messages.at(-1)?.content).toContain('The app renders D2 directly.');
		expect(body.messages.at(-1)?.content).not.toContain('D2 Online Editor');
	});

	it('uses Anthropic for chat mode when bindings are configured', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: 'This is an Anthropic-generated response.',
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'help me scope this canvas',
			contextMode: 'all',
			generationMode: 'chat',
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		expect(result.message.content).toBe('This is an Anthropic-generated response.');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('passes recent conversation history to Anthropic', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: 'Follow-up response.',
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		await generateAssistantResponse({
			message: 'Continue from the earlier response',
			contextMode: 'none',
			generationMode: 'chat',
			history: [
				{
					id: 'user-1',
					role: 'user',
					content: 'Draft a resume summary',
					createdAt: new Date().toISOString(),
				},
				{
					id: 'assistant-1',
					role: 'assistant',
					content: 'Here is the earlier response.',
					createdAt: new Date().toISOString(),
				},
			],
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		const init = (fetchMock.mock.calls.at(0) as unknown[] | undefined)?.at(1) as
			| RequestInit
			| undefined;
		expect(JSON.parse(String(init?.body))).toMatchObject({
			messages: [
				{ role: 'user', content: 'Draft a resume summary' },
				{ role: 'assistant', content: 'Here is the earlier response.' },
				{ role: 'user', content: 'Continue from the earlier response' },
			],
		});
	});

	it('falls back to a functional app when Anthropic returns a marketing prototype for an app request', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: [
									'```json',
									JSON.stringify(
										{
											title: 'A Calculator Website',
											template: 'react',
											activeFile: '/App.jsx',
											files: {
												'/App.jsx': {
													code: 'export default function App() { return <main><button>Start Free</button><button>See the tour</button></main>; }',
												},
												'/index.jsx': {
													code: "import { createRoot } from 'react-dom/client';",
													hidden: true,
												},
												'/styles.css': { code: 'main { padding: 24px; }' },
											},
										},
										null,
										2,
									),
									'```',
								].join('\n'),
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'Create a prototype calculator app',
			contextMode: 'selected',
			generationMode: 'prototype',
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		expect(result.message.artifacts?.[0]?.content).toContain('/components/CalculatorButton.jsx');
		expect(result.message.artifacts?.[0]?.content).not.toContain('Start Free');
	});

	it('falls back to a playable game when Anthropic returns an interactive landing page for a game request', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: [
									'```json',
									JSON.stringify(
										{
											title: 'Tetris Website',
											template: 'react',
											activeFile: '/App.jsx',
											preview: {
												eyebrow: 'Launch faster',
												title: 'Tetris for modern teams',
												description: 'An interactive waitlist and pricing surface.',
												accent: '#7c3aed',
												background: '#0f172a',
												badges: ['Pricing', 'Waitlist'],
												metrics: [{ label: 'Plans', value: '3' }],
											},
											files: {
												'/App.jsx': {
													code: [
														"import { useState } from 'react';",
														'',
														'export default function App() {',
														"  const [plan, setPlan] = useState('solo');",
														'  return (',
														'    <main className="landing-frame">',
														'      <h1>Tetris for modern teams</h1>',
														'      <p>Compare pricing and join the waitlist.</p>',
														"      <button onClick={() => setPlan('solo')}>Solo</button>",
														"      <button onClick={() => setPlan('team')}>Team</button>",
														'      <div>{plan}</div>',
														'    </main>',
														'  );',
														'}',
													].join('\n'),
												},
												'/index.jsx': {
													code: "import { createRoot } from 'react-dom/client';",
													hidden: true,
												},
												'/styles.css': { code: '.landing-frame { padding: 24px; }' },
											},
										},
										null,
										2,
									),
									'```',
								].join('\n'),
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'Create a tetris game prototype',
			contextMode: 'selected',
			generationMode: 'prototype',
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		expect(result.message.artifacts?.[0]?.content).toContain('"title": "Tetris Game"');
		expect(result.message.artifacts?.[0]?.content).toContain('game-board');
		expect(result.message.artifacts?.[0]?.content).toContain('Move Left');
		expect(result.message.artifacts?.[0]?.content).not.toContain('"title": "Tetris Website"');
		expect(result.message.artifacts?.[0]?.content).not.toContain('join the waitlist');
	});

	it('falls back to a blank scaffold when Anthropic returns a starter-shaped landing page', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: [
									'```json',
									JSON.stringify(
										{
											title: 'A Pok Website',
											template: 'react',
											activeFile: '/App.jsx',
											preview: {
												eyebrow: 'Conversion-ready website',
												title: 'A Pok Website',
												description: 'Launch a sharper story and faster conversion.',
												accent: '#2563eb',
												background: '#eff6ff',
												badges: ['Launch', 'Conversion'],
												metrics: [{ label: 'Visitors', value: '24k' }],
											},
											files: {
												'/App.jsx': {
													code: [
														'export default function App() {',
														'  return (',
														'    <main className="landing-frame">',
														'      <h1>Launch a pok mon with a sharper story.</h1>',
														'      <button>Start Free</button>',
														'      <button>See the tour</button>',
														'    </main>',
														'  );',
														'}',
													].join('\n'),
												},
												'/index.jsx': {
													code: "import { createRoot } from 'react-dom/client';",
													hidden: true,
												},
												'/styles.css': { code: '.landing-frame { padding: 24px; }' },
											},
										},
										null,
										2,
									),
									'```',
								].join('\n'),
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'Can you please create a prototype of a Pokemon landing page?',
			contextMode: 'selected',
			generationMode: 'prototype',
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		expect(result.message.artifacts?.[0]?.content).toContain('Blank prototype scaffold');
		expect(result.message.artifacts?.[0]?.content).toContain('/index.jsx');
		expect(result.message.artifacts?.[0]?.content).not.toContain('/App.jsx');
		expect(result.message.artifacts?.[0]?.content).not.toContain('Start Free');
		expect(result.message.artifacts?.[0]?.content).not.toContain('PulseBoard');
	});
});
