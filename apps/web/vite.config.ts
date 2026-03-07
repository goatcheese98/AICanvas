import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'node:path';

const roughJsEntry = path.resolve(__dirname, '../../node_modules/roughjs/bin/rough.js');

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
