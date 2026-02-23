# Quick Start Guide

Get your WordPress site with custom domain up and running in under 10 minutes!

## Prerequisites Checklist

Before starting, make sure you have:

- [ ] InstaWP account with API key
- [ ] Namecheap account with API enabled
- [ ] Your IP address whitelisted in Namecheap
- [ ] Node.js 18+ installed
- [ ] Funds in Namecheap account for domain registration

## Step 1: Get Your API Keys

### InstaWP API Key

1. Go to [InstaWP Dashboard](https://app.instawp.io)
2. Click on your profile (top right)
3. Navigate to "Account Settings" or "API Settings"
4. Generate a new API token
5. Copy and save it securely

### Namecheap API Key

1. Log in to [Namecheap](https://www.namecheap.com)
2. Go to Profile > Tools > API Access
3. Click "Enable API Access"
4. Whitelist your IP address:
   - Find your IP: visit https://whatismyipaddress.com
   - Add it to the whitelist
5. Copy your API key and username

## Step 2: Configure the Integration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Open `.env` in your text editor and fill in:

```bash
# Required: InstaWP API Key
INSTA_WP_API_KEY=paste_your_instawp_key_here

# Required: Namecheap Credentials
NAMECHEAP_API_KEY=paste_your_namecheap_api_key
NAMECHEAP_USERNAME=your_namecheap_username
NAMECHEAP_CLIENT_IP=your_whitelisted_ip

# Required: Contact Information
CONTACT_EMAIL=your@email.com
CONTACT_FIRST_NAME=John
CONTACT_LAST_NAME=Doe
CONTACT_ADDRESS=123 Main Street
CONTACT_CITY=New York
CONTACT_STATE=NY
CONTACT_POSTAL_CODE=10001
CONTACT_COUNTRY=US
CONTACT_PHONE=+1.2125551234

# Optional: Template to use (default is flexify)
TEMPLATE_SLUG=flexify
```

## Step 3: Test Your Setup

Run the test script to verify everything is configured correctly:

```bash
npm run test
```

You should see:
- Configuration validation pass
- Namecheap API connection success
- InstaWP API connection success
- List of available templates

## Step 4: Find Your Template

The test will show available templates. If you want to use "flexify" (from flexify.instawp.dev):

1. Look for "flexify" in the template list
2. Note the exact slug
3. Update `TEMPLATE_SLUG` in `.env` if needed

## Step 5: Create Your Website

Now you're ready! Run the complete flow:

```bash
npm start yourdomain.com
```

Replace `yourdomain.com` with your desired domain name.

### What Happens Next

The script will:

1. ✅ Check if domain is available
2. ✅ Register the domain with Namecheap
3. ✅ Create WordPress site from template
4. ✅ Map your domain to the site
5. ✅ Configure DNS automatically
6. ⏳ SSL certificate generates automatically (5-15 min)

## Step 6: Access Your Site

After the script completes:

1. **Temporary URL**: Access immediately via the InstaWP URL shown
2. **Custom Domain**: Wait 5-15 minutes for DNS propagation
3. **SSL**: Automatically configured by InstaWP

Visit `https://yourdomain.com` once DNS propagates!

## Common Commands

### Test without registering domain
```bash
node src/index.js example.com --dry-run
```

### Use existing domain (skip registration)
```bash
node src/index.js example.com --skip-registration
```

### Map www subdomain too
```bash
node src/index.js example.com --www
```

### Wait for SSL verification
```bash
node src/index.js example.com --wait-ssl
```

## Troubleshooting Quick Fixes

### "Configuration validation failed"
- Check all required variables in `.env` are filled in
- Ensure no quotes around values
- Verify email address is valid

### "Namecheap API Error"
- Verify API key is correct
- Check IP is whitelisted in Namecheap
- Ensure API access is enabled
- Try sandbox mode first: `NAMECHEAP_SANDBOX=true`

### "InstaWP API Error"
- Verify API key is valid and not expired
- Check account has available resources
- Try listing templates with `npm run test`

### "Template not found"
- Run `npm run test` to see available templates
- Update `TEMPLATE_SLUG` in `.env` with correct slug
- Check spelling and capitalization

### DNS not propagating
- Wait longer (up to 48 hours, usually 5-15 minutes)
- Check DNS at https://dnschecker.org
- Verify A records in Namecheap dashboard

## Using Sandbox Mode (Testing)

To test without spending money:

1. Create free account at https://www.sandbox.namecheap.com
2. Enable API in sandbox
3. Set `NAMECHEAP_SANDBOX=true` in `.env`
4. Use sandbox credentials

## Next Steps After Creation

Once your site is live:

1. **Access WordPress Admin**
   - URL: `https://yourdomain.com/wp-admin`
   - Login credentials in InstaWP dashboard

2. **Customize Your Site**
   - Install plugins
   - Change theme
   - Add content

3. **Configure Email**
   - Set up SMTP
   - Configure contact forms

4. **Security**
   - Update all passwords
   - Install security plugins
   - Enable 2FA

5. **Backups**
   - Configure automated backups
   - Test restore process

## Getting Help

- Check the full [README.md](README.md) for detailed documentation
- Review [INTEGRATION_ARCHITECTURE.md](INTEGRATION_ARCHITECTURE.md) for technical details
- InstaWP Docs: https://docs.instawp.com
- Namecheap Support: https://www.namecheap.com/support/

## Security Reminders

- Never commit `.env` to version control
- Keep API keys private
- Use strong passwords
- Regularly rotate API keys
- Only whitelist necessary IPs

## Cost Estimate

- Domain registration: $8-15/year (varies by TLD)
- InstaWP hosting: Check pricing at instawp.com
- SSL certificate: Free (Let's Encrypt)

That's it! You're ready to create WordPress sites with custom domains automatically.
