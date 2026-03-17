import path from 'node:path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { configDefaults } from 'vitest/config';

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

	if (id.includes('@excalidraw/excalidraw') || id.includes('/roughjs/')) {
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

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const releaseName = env.VITE_SENTRY_RELEASE || env.SENTRY_RELEASE;
	const devServerPort = Number.parseInt(env.VITE_PORT || env.PORT || '5173', 10);
	const apiProxyTarget = (env.VITE_API_PROXY_TARGET || env.API_PROXY_TARGET || 'http://localhost:8787')
		.trim();
	const shouldUploadSourcemaps = Boolean(
		env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT,
	);

	return {
		plugins: [
			TanStackRouterVite({ routesDirectory: './src/routes' }),
			react(),
			tailwindcss(),
			...(shouldUploadSourcemaps
				? [
						sentryVitePlugin({
							org: env.SENTRY_ORG,
							project: env.SENTRY_PROJECT,
							authToken: env.SENTRY_AUTH_TOKEN,
							release: releaseName
								? {
										name: releaseName,
										create: true,
										finalize: true,
									}
								: undefined,
							telemetry: false,
							sourcemaps: {
								assets: './dist/**',
							},
						}),
					]
				: []),
		],
		resolve: {
			dedupe: ['react', 'react-dom'],
			alias: [{ find: '@', replacement: path.resolve(__dirname, './src') }],
		},
		server: {
			port: Number.isNaN(devServerPort) ? 5173 : devServerPort,
			strictPort: true,
			proxy: {
				'/api': {
					target: apiProxyTarget,
					changeOrigin: true,
				},
			},
		},
		build: {
			sourcemap: true,
			rollupOptions: {
				output: {
					manualChunks,
				},
			},
		},
		test: {
			environment: 'jsdom',
			exclude: [...configDefaults.exclude, 'e2e/**'],
			setupFiles: ['./src/test/setup.ts'],
			server: {
				deps: {
					inline: ['@excalidraw/excalidraw', 'roughjs'],
				},
			},
		},
	};
});
