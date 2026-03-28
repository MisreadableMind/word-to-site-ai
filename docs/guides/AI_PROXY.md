# AI Proxy — Developer Reference

## Flow

1. **Site is created** during onboarding
2. **Server registers a proxy key** and pushes it to the WP site via `POST /wp-json/wordtosite/v1/set-proxy-config`
3. **Plugin receives and stores** `proxyUrl` + `apiKey`
4. **Plugin uses them** to make AI requests

The plugin does NOT register itself. We handle everything server-side with retries if the push fails.

## What the plugin receives

The server pushes this to the site after creation:

```
POST https://{site}/wp-json/wordtosite/v1/set-proxy-config
Content-Type: application/json

{
  "proxyUrl": "https://wordtosite.com/api/proxy",
  "apiKey": "wts_aBcDeFgH1234..."
}
```

The plugin should store both as WP options and return `200`.

## Making AI requests

```
POST {proxyUrl}/v1/responses
Authorization: Bearer {apiKey}
Content-Type: application/json

{
  "model": "gpt-4o-mini",
  "input": "Your prompt here"
}
```

Body is passed through to OpenAI Responses API as-is. Response returned unmodified.

### PHP example

```php
$proxy_url = get_option('wordtosite_proxy_url');
$api_key   = get_option('wordtosite_api_key');

$response = wp_remote_post($proxy_url . '/v1/responses', [
    'headers' => [
        'Authorization' => 'Bearer ' . $api_key,
        'Content-Type'  => 'application/json',
    ],
    'body' => json_encode([
        'model' => 'gpt-4o-mini',
        'input' => $prompt,
    ]),
]);
```

## Checking usage (optional)

```
GET {proxyUrl}/v1/usage
Authorization: Bearer {apiKey}
```

```json
{
  "domain": "mysite.com",
  "period": "2026-03",
  "usage": { "allowed": true, "used": 42000, "limit": 100000, "remaining": 58000 }
}
```

## Response codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `401` | Invalid or revoked API key |
| `429` | Monthly token quota exceeded |
| `502` | OpenAI upstream error |

## Plugin summary

1. **Receive** `set-proxy-config` — store `proxyUrl` and `apiKey`
2. **Use** `POST {proxyUrl}/v1/responses` with `Authorization: Bearer {apiKey}` for AI calls
3. **Check** `GET {proxyUrl}/v1/usage` (optional) to show remaining quota
