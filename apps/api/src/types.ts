/// <reference types="@cloudflare/workers-types" />

export type AppEnv = {
	Bindings: {
		DB: D1Database;
		R2: R2Bucket;
		CLERK_SECRET_KEY: string;
		ANTHROPIC_API_KEY: string;
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
