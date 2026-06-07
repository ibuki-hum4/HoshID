# Go API OAuth/OIDC Integration

## 1. Client registration

Use the bootstrap route to provision the Go API client once, or wire it into a k8s Job.

### Request

```http
POST /api/admin/oauth/clients/go
x-admin-bootstrap-token: <OIDC_ADMIN_BOOTSTRAP_TOKEN>
content-type: application/json
```

```json
{
  "redirectUris": ["https://api.example.com/auth/callback"],
  "clientName": "Go API",
  "clientUri": "https://api.example.com",
  "logoUri": "https://api.example.com/logo.png",
  "contacts": ["security@example.com"],
  "tokenEndpointAuthMethod": "client_secret_basic",
  "grantTypes": ["authorization_code", "refresh_token"],
  "responseTypes": ["code"],
  "type": "web"
}
```

## 2. Authorization request

Use the standard authorization code flow with PKCE.

Required parameters:

- `response_type=code`
- `client_id=<OIDC_GO_CLIENT_ID>`
- `redirect_uri=<registered redirect URI>`
- `scope=openid profile email offline_access`
- `state=<random CSRF token>`
- `nonce=<random value>`
- `code_challenge=<S256 challenge>`
- `code_challenge_method=S256`

## 3. Token exchange

Exchange the code at `/api/auth/oauth2/token`.

Required parameters:

- `grant_type=authorization_code`
- `code=<authorization code>`
- `redirect_uri=<same redirect URI>`
- `client_id=<OIDC_GO_CLIENT_ID>`
- `client_secret=<OIDC_GO_CLIENT_SECRET>`
- `code_verifier=<original PKCE verifier>`

## 4. Resource access

Call your Go API with the returned bearer token.

```http
Authorization: Bearer <access_token>
```

## 5. Rotation rules

- Keep `OIDC_JWK_CURRENT` and `OIDC_JWK_PREVIOUS` available during rolling deploys.
- Rotate by promoting the current key to previous, then publishing a new current key.
- Keep overlap longer than the maximum access token lifetime plus skew.
