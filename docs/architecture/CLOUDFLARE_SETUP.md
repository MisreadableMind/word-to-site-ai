# Cloudflare DNS Setup Guide

Complete guide to using Cloudflare for DNS management with InstaWP and Namecheap integration.

## Why Use Cloudflare?

When you use Cloudflare for DNS, you get:

- **CDN (Content Delivery Network)** - Faster site loading worldwide
- **DDoS Protection** - Automatic protection against attacks
- **Web Application Firewall (WAF)** - Security rules and threat detection
- **Free SSL** - Additional SSL layer (on top of InstaWP's SSL)
- **Analytics** - Detailed traffic and security analytics
- **Caching** - Automatic content caching
- **Compression** - Brotli and Gzip compression
- **HTTP/2 & HTTP/3** - Latest protocols for better performance
- **Always Online** - Serves cached version if origin is down

## Architecture

With Cloudflare enabled:

```
User → Cloudflare (CDN/Proxy) → InstaWP Server → WordPress
```

**Flow:**
1. Register domain with Namecheap
2. Point Namecheap nameservers to Cloudflare
3. Configure DNS A records in Cloudflare
4. Cloudflare proxies traffic to InstaWP
5. InstaWP generates SSL certificate

## Prerequisites

### 1. Cloudflare Account

Sign up at [cloudflare.com](https://www.cloudflare.com/):
- Free plan is sufficient
- Pro plan ($20/mo) adds more features
- Verify your email

### 2. Get Cloudflare API Credentials

#### API Key (Global API Key)

1. Log in to Cloudflare
2. Go to "My Profile" → "API Tokens"
3. Scroll to "Global API Key"
4. Click "View" and copy the key
5. Save it securely

#### Account ID

1. Go to Cloudflare dashboard
2. Click on any domain (or create one)
3. Scroll down on Overview page
4. Copy "Account ID" from the right sidebar

#### Email

Use the email address you signed up with.

## Configuration

### Update .env File

```bash
# Set DNS provider to Cloudflare
DNS_PROVIDER=cloudflare

# Cloudflare credentials
CLOUDFLARE_API_KEY=your_global_api_key_here
CLOUDFLARE_EMAIL=your@email.com
CLOUDFLARE_ACCOUNT_ID=your_account_id_here

# Namecheap (still required for domain registration)
NAMECHEAP_API_KEY=your_namecheap_key
NAMECHEAP_USERNAME=your_username
NAMECHEAP_CLIENT_IP=your_ip
```

## Usage

### Basic Website Creation with Cloudflare

```bash
npm start yourdomain.com
```

This will automatically:
1. Register domain with Namecheap
2. Create InstaWP site from template
3. Create Cloudflare zone
4. Update nameservers to Cloudflare
5. Configure DNS A records in Cloudflare
6. Enable Cloudflare proxy (CDN + DDoS protection)
7. Configure security settings
8. Enable performance optimizations

### What Gets Configured Automatically

#### Security Settings

- **Always Use HTTPS** - Redirects HTTP to HTTPS
- **SSL Mode** - Flexible SSL between Cloudflare and origin
- **Security Level** - Medium (balanced protection)
- **Browser Integrity Check** - Blocks suspicious browsers
- **Challenge Passage** - 30-minute cookie for passed challenges

#### Performance Settings

- **Brotli Compression** - Better than gzip
- **Minification** - CSS, HTML, and JavaScript
- **Rocket Loader** - Async JavaScript loading
- **HTTP/2** - Multiplexed connections
- **HTTP/3** - QUIC protocol support

#### DNS Configuration

- **Proxied A Records** - Orange cloud (CDN enabled)
- **Automatic TTL** - Cloudflare manages caching
- **www Support** - If `--www` flag is used

## Timeline Expectations

### Initial Setup (Minutes)

1. **Domain Registration**: 1-2 minutes
2. **InstaWP Site Creation**: 2-5 minutes
3. **Cloudflare Zone Creation**: Instant
4. **DNS Configuration**: Instant

### Propagation (Hours to Days)

1. **Nameserver Update**: 24-48 hours (usually faster)
2. **DNS Propagation**: After nameservers update
3. **SSL Certificate**: 15 minutes after DNS is active

**Important:** Your site won't be accessible via custom domain until nameserver propagation completes.

## Monitoring Nameserver Propagation

### Check Nameserver Status

```bash
dig NS yourdomain.com
# or
nslookup -type=NS yourdomain.com
```

Look for Cloudflare nameservers:
```
yourdomain.com.  nameserver = alice.ns.cloudflare.com.
yourdomain.com.  nameserver = bob.ns.cloudflare.com.
```

### Online Tools

- [WhatsMyDNS.net](https://whatsmydns.net) - Global DNS propagation checker
- [DNS Checker](https://dnschecker.org) - Check DNS records worldwide

## Cloudflare Dashboard

After setup, visit your Cloudflare dashboard:

### Overview Tab
- Traffic analytics
- Threat detection
- Performance metrics

### DNS Tab
- View/edit DNS records
- Toggle proxy status (orange/gray cloud)
- Add additional records (MX, TXT, etc.)

### SSL/TLS Tab
- SSL mode (Flexible, Full, Full Strict)
- Edge certificates
- Origin certificates

### Speed Tab
- Caching configuration
- Optimization settings
- Auto Minify

### Firewall Tab
- Security rules
- Rate limiting
- IP access rules

## Advanced Configuration

### Custom Cloudflare Rules

After initial setup, you can add custom rules:

```javascript
import CloudflareAPI from './src/cloudflare.js';

const cloudflare = new CloudflareAPI();
const zones = await cloudflare.listZones();
const zone = zones.find(z => z.name === 'yourdomain.com');

// Add custom firewall rule
// Add page rules
// Configure rate limiting
// etc.
```

### Proxy vs DNS Only

**Proxied (Orange Cloud)** - Default
- Traffic goes through Cloudflare
- CDN + Security enabled
- Hides origin IP
- SSL at edge

**DNS Only (Gray Cloud)**
- Direct connection to origin
- No CDN or security
- Origin IP visible
- Faster initial connection

To disable proxy for a record:
```javascript
await cloudflare.createDnsRecord(zoneId, {
  type: 'A',
  name: 'direct.yourdomain.com',
  content: ipAddress,
  proxied: false, // Gray cloud
});
```

## Troubleshooting

### "Nameservers not updated"

**Issue:** Nameserver change didn't take effect

**Solution:**
1. Check Namecheap dashboard manually
2. Verify nameservers are set correctly
3. Wait 24-48 hours for propagation
4. Contact Namecheap support if stuck

### "SSL Certificate Pending"

**Issue:** SSL showing "Pending Validation"

**Solution:**
1. Wait for nameserver propagation first
2. Check DNS records are correct
3. Ensure InstaWP can reach the domain
4. SSL generates automatically after DNS works

### "Cloudflare API Error: Zone not found"

**Issue:** Can't find Cloudflare zone

**Solution:**
1. Verify CLOUDFLARE_ACCOUNT_ID is correct
2. Check API key permissions
3. Ensure zone was created successfully

### "Too Many Redirects"

**Issue:** Site shows redirect loop error

**Solution:**
1. Go to Cloudflare dashboard → SSL/TLS
2. Change SSL mode to "Flexible"
3. Or configure InstaWP to use Full SSL

### "Error 521: Web Server Is Down"

**Issue:** Cloudflare can't connect to InstaWP

**Solution:**
1. Verify A records point to correct IPs
2. Check InstaWP site is running
3. Wait for DNS propagation
4. Temporarily pause Cloudflare proxy

## Comparison: Cloudflare vs Namecheap DNS

| Feature | Cloudflare | Namecheap DNS |
|---------|-----------|---------------|
| Setup Time | 24-48 hours | 5-15 minutes |
| CDN | ✅ Global CDN | ❌ No CDN |
| DDoS Protection | ✅ Automatic | ❌ None |
| WAF | ✅ Yes | ❌ No |
| Caching | ✅ Automatic | ❌ No |
| Analytics | ✅ Detailed | ❌ Basic |
| SSL | ✅ Edge + Origin | ❌ Origin only |
| Performance | ⚡ Faster (CDN) | 🐌 Slower |
| Complexity | 🔧 More complex | ✅ Simple |
| Cost | 💰 Free | 💰 Free |

## When to Use Each

### Use Cloudflare When:
- You want maximum performance
- Security is important (e-commerce, sensitive data)
- You expect high traffic
- You want detailed analytics
- You need DDoS protection
- Global audience

### Use Namecheap DNS When:
- You want quick setup (minutes not days)
- Simple site with low traffic
- Local/regional audience
- Testing or development
- Simplicity over features

## Example: Full Production Setup

```bash
# 1. Configure for Cloudflare
cat > .env <<EOF
DNS_PROVIDER=cloudflare
CLOUDFLARE_API_KEY=abc123...
CLOUDFLARE_EMAIL=you@example.com
CLOUDFLARE_ACCOUNT_ID=def456...
# ... other settings
EOF

# 2. Create site with www support
npm start mybusiness.com --www

# 3. Wait for nameserver propagation (24-48 hours)
# Check: dig NS mybusiness.com

# 4. Once propagated, verify site
curl -I https://mybusiness.com

# 5. Check Cloudflare dashboard
# - Analytics → Traffic
# - Security → Events
# - DNS → Records

# 6. Optional: Add email (MX records)
# Do this manually in Cloudflare dashboard
```

## Security Best Practices

1. **Enable 2FA** on Cloudflare account
2. **Use API Tokens** instead of Global API Key (more secure)
3. **Review Firewall Rules** regularly
4. **Monitor Security Events** in dashboard
5. **Enable Rate Limiting** for login pages
6. **Use Page Rules** to protect admin areas
7. **Keep API keys secure** - never commit to git

## Performance Optimization Tips

1. **Enable Auto Minify** - Reduces file sizes
2. **Set Browser Cache TTL** - Longer caching
3. **Use Page Rules** - Cache everything on static pages
4. **Enable Argo Smart Routing** - Faster routing ($5/mo)
5. **Use Polish** - Image optimization (Pro plan)
6. **Enable Railgun** - Dynamic content optimization (Business plan)

## Cost Breakdown

**Free Plan (Sufficient for most):**
- Unlimited DDoS protection
- Global CDN
- Free SSL
- DNS management
- Basic analytics

**Pro Plan ($20/mo per domain):**
- WAF rules
- Image optimization
- Mobile optimization
- Better analytics

**Business Plan ($200/mo per domain):**
- Advanced security
- Railgun optimization
- PCI compliance

## Support Resources

- [Cloudflare Documentation](https://developers.cloudflare.com/)
- [Community Forum](https://community.cloudflare.com/)
- [API Documentation](https://developers.cloudflare.com/api/)
- [Status Page](https://www.cloudflarestatus.com/)

## Next Steps

1. Test the integration with a test domain
2. Monitor nameserver propagation
3. Configure additional Cloudflare features
4. Set up analytics and alerts
5. Add custom page rules
6. Configure email (MX records)

Happy building with Cloudflare!
