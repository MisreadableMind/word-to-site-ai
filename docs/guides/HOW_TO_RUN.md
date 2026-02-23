# How to Run - Step by Step Guide

Complete guide to get your first WordPress site up and running!

## Prerequisites

- Node.js 18+ installed ([download here](https://nodejs.org))
- InstaWP account
- Namecheap account with funds for domain registration
- Cloudflare account (free - optional but recommended)

---

## Quick Start (5 Minutes)

### 1. Copy and Configure Environment

```bash
# Navigate to the project
cd /Users/v.ratushnyi-dev/Desktop/zero-click-web-waas

# Copy environment template
cp .env.example .env

# Open .env in your editor
nano .env
# or
code .env
# or
open .env
```

### 2. Fill in Your Credentials

Edit `.env` and replace these values:

#### **Required - InstaWP:**
```bash
INSTA_WP_API_KEY=xLer3Cq5UUYMzBpvP4sMfbJPLpQ7OkszJG95hBVH  # Your actual InstaWP key
```

#### **Required - Namecheap:**
```bash
NAMECHEAP_API_KEY=abc123xyz456...  # Your Namecheap API key
NAMECHEAP_USERNAME=yourusername     # Your Namecheap username
NAMECHEAP_CLIENT_IP=123.45.67.89   # Your whitelisted IP
```

#### **Required - Contact Info (for domain registration):**
```bash
CONTACT_FIRST_NAME=John
CONTACT_LAST_NAME=Doe
CONTACT_ADDRESS=123 Main Street
CONTACT_CITY=New York
CONTACT_STATE=NY
CONTACT_POSTAL_CODE=10001
CONTACT_COUNTRY=US
CONTACT_PHONE=+1.2125551234
CONTACT_EMAIL=john.doe@example.com  # Your real email
```

#### **Optional - Cloudflare (Recommended):**
```bash
DNS_PROVIDER=cloudflare  # or 'namecheap' for simple/fast setup

CLOUDFLARE_API_KEY=your_global_api_key_here
CLOUDFLARE_EMAIL=your@email.com
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

### 3. Test Your Configuration

```bash
npm run test
```

**Expected output:**
```
========================================
API Integration Tests
========================================

=== Validating Configuration ===

✅ Configuration valid!
   DNS Provider: cloudflare

=== Testing Namecheap API ===

Test 1: Checking domain availability...
✅ Domain check successful!

=== Testing InstaWP API ===

Test 1: Listing templates...
✅ Found 25 templates

First 5 templates:
   1. Flexify Template (slug: flexify)
   2. Business Pro (slug: business-pro)
   ...

=== Testing Cloudflare API ===

Test 1: Listing Cloudflare zones...
✅ Found 3 zone(s)

========================================
✅ All tests passed!
========================================
```

### 4. Create Your First Website!

```bash
npm start yourdomain.com
```

Or with www subdomain:
```bash
npm start yourdomain.com --www
```

---

## Detailed Examples

### Example 1: Basic Website

```bash
npm start mybusiness.com
```

**What happens:**
1. Checks if `mybusiness.com` is available ✅
2. Registers domain with Namecheap ($8-15) 💰
3. Creates WordPress site from flexify template 🌐
4. Maps domain to InstaWP site 🔗
5. Creates Cloudflare zone 🌩️
6. Updates nameservers to Cloudflare 📡
7. Configures DNS A records ⚙️
8. Enables CDN + DDoS protection 🛡️
9. Configures SSL (automatic) 🔒

**Timeline:**
- Setup: 5 minutes
- Nameserver propagation: 24-48 hours
- Site accessible: After propagation

### Example 2: Quick Test (No Purchase)

```bash
npm start testdomain.com --dry-run
```

**What happens:**
- ✅ Checks domain availability
- ✅ Creates the WordPress site
- ❌ Doesn't register the domain (no charge)
- ✅ Shows what would happen

### Example 3: Use Existing Domain

```bash
npm start myexistingdomain.com --skip-registration
```

**What happens:**
- ✅ Skips domain registration
- ✅ Creates WordPress site
- ✅ Configures DNS
- ℹ️ You already own the domain

### Example 4: Fast Setup (Namecheap DNS)

If you want site live in 5-15 minutes instead of 24-48 hours:

**Edit `.env`:**
```bash
DNS_PROVIDER=namecheap
```

**Then run:**
```bash
npm start quickdomain.com
```

**Trade-off:**
- ✅ Fast (5-15 min)
- ❌ No CDN
- ❌ No DDoS protection

---

## Command Line Options

```bash
# Basic
npm start domain.com

# Include www subdomain
npm start domain.com --www

# Test without purchasing
npm start domain.com --dry-run

# Skip domain registration (use existing)
npm start domain.com --skip-registration

# Skip DNS configuration (manual setup)
npm start domain.com --skip-dns

# Wait for SSL verification
npm start domain.com --wait-ssl

# Allow premium domains
npm start domain.com --allow-premium

# Combine options
npm start domain.com --www --wait-ssl
```

---

## Troubleshooting

### Error: "Configuration validation failed"

**Problem:** Missing required environment variables

**Solution:**
```bash
# Check what's missing
npm run test

# Common issues:
# - INSTA_WP_API_KEY not set
# - NAMECHEAP_API_KEY not set
# - CONTACT_EMAIL not set
```

### Error: "Namecheap API Error: Invalid API key"

**Problem:** Wrong API key or IP not whitelisted

**Solution:**
1. Double-check API key in Namecheap dashboard
2. Verify your IP is whitelisted
3. Make sure API access is enabled

```bash
# Check your current IP
curl ifconfig.me
```

### Error: "Template not found"

**Problem:** Template slug doesn't exist

**Solution:**
```bash
# List available templates
npm run test

# Update .env with correct slug
TEMPLATE_SLUG=correct-slug-name
```

### Error: "Cloudflare API Error"

**Problem:** Wrong Cloudflare credentials

**Solution:**
1. Verify `CLOUDFLARE_API_KEY` is your Global API Key
2. Check `CLOUDFLARE_EMAIL` matches your account
3. Confirm `CLOUDFLARE_ACCOUNT_ID` is correct

**Or switch to Namecheap DNS:**
```bash
# In .env
DNS_PROVIDER=namecheap
```

### Site not loading after setup

**With Cloudflare (24-48 hour wait):**
```bash
# Check nameserver propagation
dig NS yourdomain.com

# Should show Cloudflare nameservers:
# alice.ns.cloudflare.com
# bob.ns.cloudflare.com
```

**With Namecheap DNS (should be quick):**
```bash
# Check A records
dig A yourdomain.com

# Should show InstaWP IPs
```

---

## Real-World Workflow

### For Testing:
```bash
# 1. Use Namecheap DNS for speed
DNS_PROVIDER=namecheap

# 2. Test without purchasing
npm start testsite.com --dry-run

# 3. If good, purchase
npm start testsite.com
```

### For Production:
```bash
# 1. Use Cloudflare for security
DNS_PROVIDER=cloudflare

# 2. Create with www support
npm start mybrand.com --www

# 3. Wait for propagation (24-48h)

# 4. Configure Cloudflare dashboard:
#    - Adjust security settings
#    - Set up page rules
#    - Configure caching
```

---

## What You'll See

### Successful Run Output:

```
========================================
InstaWP + Namecheap + Cloudflare Website Creation Flow
========================================

--- Step 1: Checking Domain Availability ---
Checking availability for domain: mybusiness.com
✅ Domain mybusiness.com is available!

--- Step 2: Registering Domain ---
Registering domain: mybusiness.com for 1 year(s)
✅ Domain registered successfully!
   - Domain ID: 123456789
   - Order ID: 987654321
   - Charged Amount: $8.88

--- Step 3: Finding InstaWP Template ---
Searching for template with slug: flexify
Found template: Flexify Template (flexify)
✅ Found template: Flexify Template

--- Step 4: Creating InstaWP Site from Template ---
Creating site from template: flexify
✅ Site created successfully!
   - Site ID: 45678
   - Site URL: https://site-45678.instawp.xyz

--- Step 5: Waiting for Site to be Ready ---
Site status: provisioning. Waiting...
✅ Site is ready!

--- Step 6: Mapping Domain to Site ---
Mapping domain mybusiness.com to site 45678
✅ Domain mapped successfully!

--- Step 7: Configuring DNS with Cloudflare ---
Creating Cloudflare zone for: mybusiness.com
✅ Zone created successfully!
   Zone ID: abc123def456
   Nameservers:
   - alice.ns.cloudflare.com
   - bob.ns.cloudflare.com

--- Step 7b: Updating Nameservers to Cloudflare ---
Setting custom nameservers for: mybusiness.com
✅ Nameservers updated successfully!
⚠️  Nameserver propagation can take 24-48 hours

--- Step 7c: Configuring A Records in Cloudflare ---
Setting A records for mybusiness.com
Creating DNS record: A mybusiness.com -> 123.45.67.89
✅ DNS record created: xyz789
✅ A records configured successfully

--- Step 7d: Configuring Cloudflare Security & Performance ---
Configuring Cloudflare security settings...
   ✅ always_use_https: on
   ✅ ssl: flexible
   ✅ security_level: medium
Configuring Cloudflare performance settings...
   ✅ brotli enabled
   ✅ minify enabled

--- Step 8: SSL Certificate ---
ℹ️  InstaWP will automatically generate SSL certificate once DNS propagates.
   This usually takes 5-15 minutes after DNS configuration.

========================================
✅ Website Creation Complete!
========================================

Domain: mybusiness.com
Site ID: 45678
Temporary URL: https://site-45678.instawp.xyz
Custom Domain: https://mybusiness.com (after DNS propagation)
Domain Registration Cost: $8.88

📝 Next Steps:
1. Wait 24-48 hours for nameserver propagation
2. Cloudflare will automatically handle DNS, CDN, and DDoS protection
3. Visit https://mybusiness.com to see your site (after nameserver propagation)
4. SSL certificate will be auto-generated by InstaWP
5. Login to WordPress admin to customize your site
6. Check Cloudflare dashboard for analytics and security settings
```

---

## Quick Reference

```bash
# Test API connections
npm run test

# Create site (Cloudflare DNS - secure, slow)
DNS_PROVIDER=cloudflare npm start domain.com

# Create site (Namecheap DNS - fast, simple)
DNS_PROVIDER=namecheap npm start domain.com

# Check domain without buying
npm start domain.com --dry-run

# Use existing domain
npm start domain.com --skip-registration

# With www subdomain
npm start domain.com --www
```

---

## Cost Breakdown

- **Domain registration**: $8-15/year (one-time, auto-renews)
- **InstaWP hosting**: Check your plan pricing
- **Cloudflare**: Free (or $20/mo for Pro features)
- **SSL certificate**: Free (Let's Encrypt + Cloudflare)

**Total minimum**: ~$8-15 + InstaWP hosting

---

## Next Steps After Site is Live

1. **Access WordPress admin**:
   - URL: `https://yourdomain.com/wp-admin`
   - Get credentials from InstaWP dashboard

2. **Customize your site**:
   - Install plugins
   - Change theme
   - Add content

3. **Configure email**:
   - Add MX records in Cloudflare/Namecheap
   - Set up SMTP for WordPress

4. **Monitor performance**:
   - Check Cloudflare dashboard
   - Review InstaWP analytics
   - Monitor uptime

5. **Secure your site**:
   - Change all default passwords
   - Install security plugins
   - Enable 2FA

---

## Getting Help

- **Documentation**: See [README.md](README.md)
- **Cloudflare Guide**: See [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md)
- **Examples**: See [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md)
- **Quick Start**: See [QUICKSTART.md](QUICKSTART.md)

---

## Ready to Go?

```bash
# 1. Configure .env
cp .env.example .env
# Edit .env with your credentials

# 2. Test
npm run test

# 3. Create your site!
npm start yourdomain.com --www
```

Good luck! 🚀
