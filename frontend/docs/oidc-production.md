# Production-Grade OIDC Design

## File layout

- `src/features/oauth/config.ts`: issuer, audience, scope allowlist, endpoint paths.
- `src/features/oauth/security/*`: scope validation, trusted-client types, JWKS env parsing.
- `src/features/oauth/application/oidc-policy.ts`: Better Auth OAuth provider plugin options.
- `app/oauth/authorize/page.tsx`: consent UI used by the OIDC plugin.
- `app/api/auth/[...better-auth]/route.ts`: Better Auth handler.
- `app/api/auth/jwks/route.ts`: explicit JWKS route backed by the current and previous signing keys.
- `app/api/admin/oauth/clients/go/route.ts`: admin bootstrap route for provisioning the Go API OAuth client.

## Runtime strategy

- Stateless pods: all state lives in PostgreSQL via Better Auth / Prisma.
- JWT signing keys: supply current and previous JWKS through env vars, and keep both available during rolling deploys.
- PKCE: require `S256` only; reject `plain`.
- Scopes: allow only `openid`, `profile`, `email`, `offline_access`.
- Consent: trusted first-party clients may skip consent, but `prompt=consent` forces it.
- Audit logs: emit JSON, mask secrets, and keep logging at the auth boundary.

## PostgreSQL / k8s notes

- Do not run migrations in app startup.
- Use a k8s Job for Prisma migration and another for JWKS rotation if needed.
- Size the connection pool from fixed pod count, not from local development defaults.
- Prefer a single application connection string with pooler or PgBouncer for web pods.
