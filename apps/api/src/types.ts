/// <reference types="@cloudflare/workers-types" />

export type AppEnv = {
	Bindings: {
		DB: D1Database;
		R2: R2Bucket;
		CLERK_SECRET_KEY: string;
		ANTHROPIC_API_KEY?: string;
		ANTHROPIC_API_BASE_URL?: string;
		ANTHROPIC_TEXT_MODEL?: string;
		OPENROUTER_API_KEY?: string;
		OPENROUTER_API_BASE_URL?: string;
		OPENROUTER_TEXT_MODEL?: string;
		OPENROUTER_TOOL_MODEL?: string;
		OPENROUTER_IMAGE_MODEL?: string;
		VECTORIZE_ASSET_URL?: string;
		VECTORIZE_ASSET_API_KEY?: string;
		ENVIRONMENT: string;
	};
	Variables: {
		user: AuthUser;
	};
};

export interface AuthUser {
	id: string;
	email: string;
	name: string;
	avatarUrl?: string;
}
