import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import './styles/globals.css';

declare global {
	interface Window {
		__aiCanvasLastReactError?: {
			kind: 'caught' | 'uncaught' | 'recoverable';
			message: string;
			componentStack?: string;
			timestamp: string;
		};
	}
}

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60, // 1 minute
			retry: 1,
		},
	},
});

const router = createRouter({
	routeTree,
	context: { queryClient },
	defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

function reportReactError(
	kind: 'caught' | 'uncaught' | 'recoverable',
	error: unknown,
	componentStack?: string,
) {
	const message = error instanceof Error ? error.message : String(error);
	const payload = {
		kind,
		message,
		componentStack,
		timestamp: new Date().toISOString(),
	};

	if (typeof window !== 'undefined') {
		window.__aiCanvasLastReactError = payload;
		window.localStorage.setItem('ai-canvas:last-react-error', JSON.stringify(payload));

		if (import.meta.env.DEV) {
			const id = 'ai-canvas-react-error-debug';
			let node = document.getElementById(id);
			if (!node) {
				node = document.createElement('pre');
				node.id = id;
				Object.assign(node.style, {
					position: 'fixed',
					right: '16px',
					bottom: '16px',
					zIndex: '999999',
					maxWidth: 'min(720px, calc(100vw - 32px))',
					maxHeight: '40vh',
					overflow: 'auto',
					padding: '12px 14px',
					borderRadius: '12px',
					background: 'rgba(15, 23, 42, 0.94)',
					color: '#f8fafc',
					fontSize: '12px',
					lineHeight: '1.45',
					whiteSpace: 'pre-wrap',
					boxShadow: '0 12px 32px rgba(15, 23, 42, 0.35)',
				});
				document.body.appendChild(node);
			}
			node.textContent = `React ${kind} error\n${message}${componentStack ? `\n\n${componentStack}` : ''}`;
		}
	}

	console.error(`[React ${kind} error]`, error, componentStack ?? '');
}

createRoot(root, {
	onCaughtError: (error, errorInfo) => {
		reportReactError('caught', error, errorInfo.componentStack);
	},
	onUncaughtError: (error, errorInfo) => {
		reportReactError('uncaught', error, errorInfo.componentStack);
	},
	onRecoverableError: (error, errorInfo) => {
		reportReactError('recoverable', error, errorInfo.componentStack);
	},
}).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	</StrictMode>,
);
