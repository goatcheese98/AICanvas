/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_BASE_URL?: string;
	readonly VITE_CLERK_PUBLISHABLE_KEY: string;
	readonly VITE_GOOGLE_MAPS_EMBED_API_KEY?: string;
	readonly VITE_PARTYKIT_HOST?: string;
	readonly VITE_SENTRY_DSN?: string;
	readonly VITE_SENTRY_ENVIRONMENT?: string;
	readonly VITE_SENTRY_RELEASE?: string;
	readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
	readonly VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE?: string;
	readonly VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
