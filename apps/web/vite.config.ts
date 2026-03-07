import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'node:path';

const roughJsEntry = path.resolve(__dirname, '../../node_modules/.bun/node_modules/roughjs/bin/rough.js');

function manualChunks(id: string) {
	if (!id.includes('node_modules')) return;

	if (
		id.includes('@excalidraw/mermaid-to-excalidraw') ||
		id.includes('/mermaid/') ||
		id.includes('mermaid/dist') ||
		id.includes('/elkjs/')
	) {
		return 'excalidraw-diagrams';
	}

	if (
		id.includes('@excalidraw/excalidraw') ||
		id.includes('/roughjs/')
	) {
		return 'excalidraw-core';
	}

	if (
		id.includes('/katex/') ||
		id.includes('/react-markdown/') ||
		id.includes('/remark-gfm/') ||
		id.includes('/remark-math/') ||
		id.includes('/rehype-katex/') ||
		id.includes('/rehype-raw/')
	) {
		return 'markdown-stack';
	}

	if (id.includes('/lexical/') || id.includes('/@lexical/')) {
		return 'lexical-stack';
	}
}

export default defineConfig({
	plugins: [
		{
			name: 'resolve-roughjs-bin',
			enforce: 'pre',
			resolveId(source) {
				if (source === 'roughjs/bin/rough') {
					return roughJsEntry;
				}
			},
		},
		TanStackRouterVite({ routesDirectory: './src/routes' }),
		react(),
		tailwindcss(),
	],
	resolve: {
		alias: [
			{ find: '@', replacement: path.resolve(__dirname, './src') },
			{ find: 'roughjs/bin/rough', replacement: roughJsEntry },
		],
	},
	server: {
		port: 5173,
		proxy: {
			'/api': {
				target: 'http://localhost:8787',
				changeOrigin: true,
			},
		},
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks,
			},
		},
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['./src/test/setup.ts'],
		server: {
			deps: {
				inline: ['@excalidraw/excalidraw', 'roughjs'],
			},
		},
	},
});
