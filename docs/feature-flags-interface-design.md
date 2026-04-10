# Feature Flags Interface Design

This document defines the smallest feature-flag system that fits the current AI Canvas stack.

The goal is controlled rollout and faster isolation of regressions, not a full experimentation platform.

## Recommendation

Start with:

- a typed in-code flag registry
- boolean flags only
- current-user evaluation
- optional per-user overrides stored in D1
- optional environment hard overrides for emergency kill switches
- a read API that returns resolved flags plus the source of truth

Do not start with:

- percentage rollouts
- multivariate flags
- workspace or organization scopes
- in-product flag admin UI
- a generic rules engine

The product is currently user-scoped. A user-scoped flag model matches the existing auth and data model and keeps the first version easy to reason about.

## Design Principles

- Every flag key is explicit and typed. No stringly-typed ad hoc flags in components.
- Resolution must be deterministic and explainable.
- The frontend should consume resolved values, not reimplement evaluation logic.
- A flag must have a removal path when the rollout is complete.
- Unknown flags should fail loudly in internal code, not silently evaluate to false.

## V1 Scope

V1 supports two use cases:

1. Ship risky changes behind a default-off flag.
2. Enable or disable a flag for specific users to isolate issues or test safely in production.

V1 does not try to solve experimentation, A/B testing, or audience segmentation.

## Flag Registry

The source of truth for valid flag keys should live in shared code.

Recommended shape:

```ts
export const featureFlagRegistry = {
	assistantV2: {
		defaultValue: false,
		description: 'Gate the new assistant panel flow.',
		owner: 'product',
		expiresAt: '2026-06-01',
	},
	canvasSharingV2: {
		defaultValue: false,
		description: 'Gate the revised sharing flow.',
		owner: 'product',
		expiresAt: '2026-06-15',
	},
} as const;

export type FeatureFlagKey = keyof typeof featureFlagRegistry;
```

Why this shape:

- keys are compile-time checked
- defaults are visible in code review
- description, owner, and expiry make cleanup enforceable

## Resolution Order

Flags should resolve in one place on the server with this precedence:

1. environment hard override
2. per-user override from D1
3. registry default

Example:

- `assistantV2` default is `false`
- user override sets it to `true` for `user_123`
- production incident sets env override to `false`
- result is `false` because the emergency override wins

This keeps kill-switch behavior obvious and avoids the frontend guessing which source takes priority.

## Data Model

V1 should keep persistence narrow.

Recommended table:

```sql
feature_flag_user_overrides
- id
- user_id
- flag_key
- enabled
- reason
- created_at
- updated_at

unique(user_id, flag_key)
index(user_id)
index(flag_key)
```

Notes:

- `reason` is optional but useful for debugging and cleanup.
- There is no separate global table in v1. Global emergency behavior belongs in environment config, not mutable app state.

## API Contract

The app should fetch resolved flags for the authenticated user from the API.

Recommended endpoint:

```http
GET /api/user/feature-flags
Authorization: Bearer <token>
```

Recommended response:

```json
{
	"data": {
		"flags": {
			"assistantV2": {
				"enabled": false,
				"source": "env_override"
			},
			"canvasSharingV2": {
				"enabled": true,
				"source": "user_override"
			}
		}
	}
}
```

Recommended source enum:

- `default`
- `user_override`
- `env_override`

Why include `source`:

- it improves observability
- support and debugging can answer why a user saw a branch
- the frontend can expose this in development without re-encoding business logic

## Type Contract

Recommended shared types:

```ts
export type FeatureFlagSource = 'default' | 'user_override' | 'env_override';

export interface ResolvedFeatureFlag {
	enabled: boolean;
	source: FeatureFlagSource;
}

export type ResolvedFeatureFlags = Record<FeatureFlagKey, ResolvedFeatureFlag>;
```

## Frontend Contract

The frontend should consume one resolved object and read flags through a single access point.

Recommended usage:

```ts
if (flags.assistantV2.enabled) {
	return <NewAssistantPanel />;
}

return <ExistingAssistantPanel />;
```

Do not:

- call `import.meta.env` directly in feature code to decide rollout
- scatter raw fallback logic across components
- invent local flag keys in app code

## Write Path

Do not build an in-app flag management UI in v1.

Use one of these first:

- direct D1 updates for per-user overrides
- a small internal script
- Wrangler/D1 SQL in deployment or ops workflow

That keeps the first version focused on safe reads and controlled rollout. If flag management becomes frequent enough to hurt, then add a protected internal write surface.

## Observability Requirements

Whenever a flag materially changes behavior, log or trace enough context to answer:

- which flag was evaluated
- what value was returned
- which source won
- which user saw it

At minimum, include resolved flag state in:

- server-side logs for flag-dependent routes when behavior diverges materially
- client-side diagnostics or breadcrumbs for major gated UI paths

Do not log the entire flag object on every request if it creates noise. Log only the flags that matter to the code path being executed.

## Naming Rules

- Use stable camelCase keys.
- Name the behavior, not the implementation detail.
- Prefer `assistantV2` over `newAssistantPanelEnabled`.
- Avoid temporary names like `testFlag` or `debugFeature`.

## Removal Rules

Every flag must have:

- an owner
- an expected cleanup date
- a default state
- a stated purpose

When a rollout is complete:

1. remove the dead branch
2. remove the registry entry
3. remove any user overrides
4. remove any environment hard override

If a flag has no credible cleanup path, it is probably configuration, not a rollout flag.

## What Not to Build Yet

These are valid future extensions, but they should not be in v1:

- percentage rollouts by hashed user ID
- team or workspace scopes
- country, device, or plan targeting
- multivariate treatment groups
- analytics-driven experimentation
- nested dependency rules between flags

Those all add state and debugging cost. Start with the smallest model that isolates changes effectively.

## Recommended Next Step

Implement this in four thin slices:

1. shared registry and shared types
2. D1 override table plus server-side resolver
3. authenticated `GET /api/user/feature-flags`
4. frontend query plus one or two real gated product paths

That is enough to prove whether feature flags are helping before you build more surface area.
