# Usage Examples

Real-world examples of using the InstaWP + Namecheap integration.

## Example 1: Basic Website Creation

Create a simple WordPress site with a .com domain:

```bash
npm start mybusiness.com
```

**What happens:**
- Checks if mybusiness.com is available
- Registers the domain for 1 year
- Creates WordPress site from default template
- Maps domain and configures DNS
- Sets up SSL automatically

**Cost:** ~$8.88 (domain) + InstaWP hosting

---

## Example 2: Test Before Buying

Check if a domain is available without registering:

```bash
node src/index.js mycoolsite.com --dry-run
```

**Result:**
- Shows if domain is available
- Shows if it's premium (and price)
- Creates the site from template
- Maps domain but doesn't register it
- No charges

---

## Example 3: Use Existing Domain

You already own a domain and just want to create the site:

```bash
node src/index.js myexistingdomain.com --skip-registration --skip-dns
```

**Then manually:**
1. Get A record IPs from the output
2. Add A records in your domain registrar
3. Wait for DNS propagation
4. SSL auto-generates

---

## Example 4: Full Featured Site with WWW

Create site with www subdomain support:

```bash
node src/index.js mybrand.com --www --wait-ssl
```

**Features:**
- Registers mybrand.com
- Maps both mybrand.com AND www.mybrand.com
- Waits for SSL certificate verification
- Confirms HTTPS is working

**Access:** Both https://mybrand.com and https://www.mybrand.com work

---

## Example 5: Multi-Year Registration

Register domain for multiple years upfront:

```bash
# Edit .env first
DOMAIN_REGISTRATION_YEARS=3

# Then run
npm start longterm.com
```

**Benefit:** Lock in current domain price, don't worry about renewals

---

## Example 6: Premium Domain

Purchase a premium domain:

```bash
node src/index.js premium-name.com --allow-premium
```

**Note:** Check pricing in dry-run first:
```bash
node src/index.js premium-name.com --dry-run
```

---

## Example 7: Custom Template

Use a different InstaWP template:

```bash
# Edit .env
TEMPLATE_SLUG=your-custom-template

# Or find available templates
npm run test

# Then create site
npm start newsite.com
```

---

## Example 8: Programmatic Usage

Use in your own Node.js application:

```javascript
import WebsiteCreationFlow from './src/index.js';

async function createClientSite(clientName, domainName) {
  const flow = new WebsiteCreationFlow();

  const result = await flow.run(domainName, {
    years: 2,
    mapWww: true,
    waitForSsl: true,
    contacts: {
      firstName: clientName.split(' ')[0],
      lastName: clientName.split(' ')[1],
      email: `contact@${domainName}`,
      // ... other contact info
    }
  });

  if (result.success) {
    console.log(`✅ Site created for ${clientName}`);
    console.log(`URL: https://${domainName}`);
    console.log(`Cost: $${result.registration.chargedAmount}`);

    // Send email to client
    await sendWelcomeEmail(clientName, domainName, result.site);
  }

  return result;
}

// Batch create sites
const clients = [
  { name: 'John Doe', domain: 'johndoe.com' },
  { name: 'Jane Smith', domain: 'janesmith.com' },
];

for (const client of clients) {
  await createClientSite(client.name, client.domain);
}
```

---

## Example 9: Testing with Sandbox

Test the flow without spending money:

```bash
# 1. Create free account at sandbox.namecheap.com
# 2. Enable API access
# 3. Edit .env
NAMECHEAP_SANDBOX=true
NAMECHEAP_API_KEY=sandbox_api_key
NAMECHEAP_USERNAME=sandbox_username

# 4. Test
npm run test

# 5. Create test site
npm start test-domain.com
```

**Note:** Sandbox domains aren't real, but you can test the entire flow.

---

## Example 10: Agency Workflow

Create multiple sites for different clients:

```javascript
import WebsiteCreationFlow from './src/index.js';
import fs from 'fs';

// Load client list from CSV/JSON
const clients = JSON.parse(fs.readFileSync('clients.json'));

const flow = new WebsiteCreationFlow();

// Track results
const results = [];

for (const client of clients) {
  console.log(`\n🚀 Creating site for ${client.name}...`);

  const result = await flow.run(client.domain, {
    years: 1,
    mapWww: true,
    contacts: {
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      address1: client.address,
      city: client.city,
      stateProvince: client.state,
      postalCode: client.zip,
      country: client.country,
    },
    templateSlug: client.template || 'flexify',
  });

  results.push({
    client: client.name,
    domain: client.domain,
    success: result.success,
    cost: result.registration?.chargedAmount,
    siteId: result.site?.id,
    siteUrl: result.site?.wp_url,
  });

  // Wait between requests to avoid rate limits
  await new Promise(resolve => setTimeout(resolve, 5000));
}

// Save report
fs.writeFileSync('deployment-report.json', JSON.stringify(results, null, 2));
console.log('\n✅ All sites created! Check deployment-report.json');
```

**clients.json example:**
```json
[
  {
    "name": "Acme Corp",
    "domain": "acmecorp.com",
    "template": "flexify",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@acmecorp.com",
    "phone": "+1.5551234567",
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "US"
  }
]
```

---

## Example 11: Error Handling

Robust error handling for production:

```javascript
import WebsiteCreationFlow from './src/index.js';

async function createSiteWithRetry(domain, maxRetries = 3) {
  const flow = new WebsiteCreationFlow();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} for ${domain}`);

      const result = await flow.run(domain, {
        mapWww: true,
        waitForSsl: false, // Don't wait for SSL on each attempt
      });

      if (result.success) {
        console.log(`✅ Success on attempt ${attempt}`);
        return result;
      }

      // If not successful but no exception, throw to retry
      throw new Error(result.error);

    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed: ${error.message}`);

      // Don't retry on certain errors
      if (error.message.includes('not available') ||
          error.message.includes('insufficient funds')) {
        console.error('Non-retryable error. Stopping.');
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error('Max retries reached. Giving up.');
        throw error;
      }
    }
  }
}

// Usage
try {
  const result = await createSiteWithRetry('example.com');
  console.log('Site created:', result.domain);
} catch (error) {
  console.error('Failed to create site:', error.message);
  // Send alert to admin
}
```

---

## Example 12: Monitoring and Logging

Add comprehensive logging:

```javascript
import WebsiteCreationFlow from './src/index.js';
import fs from 'fs';

class MonitoredWebsiteCreation extends WebsiteCreationFlow {
  constructor() {
    super();
    this.logFile = `logs/creation-${Date.now()}.log`;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    // Console output
    console.log(message);

    // File logging
    fs.appendFileSync(this.logFile, logMessage);
  }

  async run(domain, options) {
    this.log(`Starting creation for ${domain}`);
    this.log(`Options: ${JSON.stringify(options)}`);

    try {
      const result = await super.run(domain, options);

      this.log(`Creation ${result.success ? 'successful' : 'failed'}`);
      this.log(`Result: ${JSON.stringify(result, null, 2)}`);

      return result;
    } catch (error) {
      this.log(`Exception occurred: ${error.message}`);
      this.log(`Stack: ${error.stack}`);
      throw error;
    }
  }
}

// Usage
const flow = new MonitoredWebsiteCreation();
await flow.run('example.com', { mapWww: true });

console.log(`Logs saved to: ${flow.logFile}`);
```

---

## Example 13: Webhook Integration

Notify external systems when site is created:

```javascript
import WebsiteCreationFlow from './src/index.js';
import axios from 'axios';

async function createSiteWithWebhook(domain, webhookUrl) {
  const flow = new WebsiteCreationFlow();

  const result = await flow.run(domain, {
    mapWww: true,
    waitForSsl: true,
  });

  // Send webhook notification
  if (result.success) {
    await axios.post(webhookUrl, {
      event: 'site_created',
      domain: result.domain,
      siteId: result.site.id,
      siteUrl: result.site.wp_url,
      customDomain: `https://${result.domain}`,
      cost: result.registration.chargedAmount,
      timestamp: new Date().toISOString(),
    });
  }

  return result;
}

// Usage
await createSiteWithWebhook(
  'example.com',
  'https://your-app.com/webhooks/site-created'
);
```

---

## Tips and Best Practices

1. **Always test first**: Use `--dry-run` to check availability
2. **Use sandbox**: Test the flow with Namecheap sandbox
3. **Monitor costs**: Track domain registration charges
4. **Handle errors**: Implement retry logic for production
5. **Log everything**: Keep audit trail of all operations
6. **Wait for SSL**: Use `--wait-ssl` for production sites
7. **Batch carefully**: Add delays between bulk operations
8. **Verify DNS**: Check propagation before assuming site is live
9. **Backup credentials**: Save InstaWP site credentials securely
10. **Document**: Keep track of which domains use which templates

---

## Common Combinations

Quick reference for common use cases:

```bash
# Quick test
npm start example.com --dry-run

# Production site with full features
npm start mybusiness.com --www --wait-ssl

# Existing domain, just create site
npm start mydomain.com --skip-registration --skip-dns

# Test environment
NAMECHEAP_SANDBOX=true npm start test.com

# Premium domain purchase
npm start premium.com --allow-premium

# Multi-year with www
DOMAIN_REGISTRATION_YEARS=3 npm start longterm.com --www
```
