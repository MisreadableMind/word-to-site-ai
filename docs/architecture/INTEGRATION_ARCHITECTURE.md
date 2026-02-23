# InstaWP + Namecheap Integration Architecture

## Overview
Complete API integration flow to create a WordPress website from a template, register a domain, and configure DNS with automatic SSL.

## Key Findings

### InstaWP API
- **Base URL**: `https://app.instawp.io/api/v2` (from Postman collection)
- **Authentication**: Bearer token
- **SSL Handling**: Automatic! InstaWP generates SSL certificates when you map a domain
- **DNS Method**: Uses A Records (not nameserver changes)

### Namecheap API
- **Full API Support**: Domain registration, DNS management, nameserver configuration
- **Authentication**: API Key + Username + Client IP
- **Sandbox Available**: Test environment at api.sandbox.namecheap.com

### Cloudflare
- **Limited API**: Domain registration only for Enterprise customers
- **Not Recommended** for this integration

## Complete Integration Flow

### Step 1: Domain Selection & Availability Check
```
1. User provides desired domain name
2. Check availability via Namecheap API: namecheap.domains.check
3. If unavailable, suggest alternatives
```

### Step 2: Domain Registration (Namecheap)
```
1. Call namecheap.domains.create with:
   - Domain name
   - Registration years
   - Contact information (registrant, admin, tech, billing)
2. Receive domain registration confirmation
3. Get Domain ID and Order ID
```

### Step 3: Create InstaWP Site from Template
```
1. Get template slug (for flexify.instawp.dev)
   - Option A: Use existing template slug if known
   - Option B: List templates via GET /templates and find "flexify"

2. Create site from template:
   POST /sites/template
   {
     "slug": "flexify-template-slug",
     "is_shared": false,
     "is_reserved": true
   }

3. Receive site_id and site details
```

### Step 4: Map Domain to InstaWP Site
```
1. Map custom domain to site:
   POST /site/add-domain/{site_id}
   {
     "name": "yourdomain.com",
     "type": "primary",
     "www": false,
     "route_www": false
   }

2. InstaWP returns A Record information:
   - Usually 2 IP addresses for A Records
   - These point to InstaWP's servers
```

### Step 5: Configure DNS A Records (Namecheap)
```
1. Set A Records via Namecheap API:
   namecheap.domains.dns.setHosts

   - Add @ (root) A Record pointing to InstaWP IP #1
   - Add @ (root) A Record pointing to InstaWP IP #2
   - Optional: Add www A Records for www subdomain support

2. DNS propagation begins (usually 5-15 minutes)
```

### Step 6: SSL Certificate (Automatic)
```
1. InstaWP detects DNS propagation
2. Automatically issues Let's Encrypt SSL certificate
3. Site becomes accessible via https://yourdomain.com

Note: SSL generation is automatic - no API call needed!
```

### Step 7: Verification & Completion
```
1. Poll InstaWP site status to verify domain is mapped
2. Check SSL certificate status
3. Return final site URL and credentials
```

## API Endpoints Summary

### InstaWP
- `GET /templates` - List available templates
- `POST /sites/template` - Create site from template
- `POST /site/add-domain/{site_id}` - Map custom domain
- `GET /sites/{site_id}` - Get site details

### Namecheap
- `namecheap.domains.check` - Check domain availability
- `namecheap.domains.create` - Register domain
- `namecheap.domains.dns.setHosts` - Set DNS A Records
- `namecheap.domains.getInfo` - Get domain details

## Required Credentials

### InstaWP
- API Token (Bearer authentication)
- From: InstaWP account settings

### Namecheap
- API Key
- API Username
- Client IP (whitelisted)
- From: Namecheap account > Profile > Tools > API Access

## Environment Variables
```
INSTAWP_API_KEY=your_instawp_api_key
NAMECHEAP_API_KEY=your_namecheap_api_key
NAMECHEAP_USERNAME=your_namecheap_username
NAMECHEAP_CLIENT_IP=your_whitelisted_ip
NAMECHEAP_SANDBOX=false  # Set to true for testing
TEMPLATE_SLUG=flexify-template-slug  # Or auto-discover
```

## Error Handling

1. **Domain Registration Fails**
   - Check domain availability again
   - Verify Namecheap account has sufficient funds
   - Validate contact information

2. **InstaWP Site Creation Fails**
   - Verify template slug exists
   - Check API quota/limits
   - Ensure account has available resources

3. **Domain Mapping Fails**
   - Verify site exists and is active
   - Check domain isn't already mapped elsewhere
   - Ensure DNS isn't locked at registrar

4. **SSL Certificate Fails**
   - Wait for DNS propagation (can take up to 48 hours)
   - Verify A Records are correct
   - Check domain is accessible via HTTP first

## Testing Strategy

1. **Phase 1**: Test each API individually
   - Namecheap domain check
   - InstaWP template list
   - Site creation (without domain)

2. **Phase 2**: Test domain registration (sandbox)
   - Use Namecheap sandbox
   - Register test domain
   - Verify registration

3. **Phase 3**: Integration test
   - Create site from template
   - Map domain
   - Configure DNS
   - Verify SSL

4. **Phase 4**: Production test
   - Use real API credentials
   - Test with actual domain
   - Monitor entire flow

## Implementation Timeline

1. Set up configuration and environment
2. Implement Namecheap integration
3. Implement InstaWP integration
4. Build orchestration layer
5. Add error handling and retries
6. Testing and validation
7. Documentation and deployment

## Sources
- [InstaWP Custom Domain Mapping](https://docs.instawp.com/en/article/mapping-a-custom-domain-for-live-sites-on-instawp-894rlu/)
- [Namecheap API Documentation](https://www.namecheap.com/support/api/methods/)
- [Namecheap Domain Registration API](https://www.namecheap.com/support/api/methods/domains/create/)
- [Cloudflare Registrar Documentation](https://developers.cloudflare.com/registrar/)
