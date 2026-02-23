# WordToSite

Website-as-a-Service platform for creating WordPress sites with automated domain registration, DNS, and SSL.

## Quick Navigation

| Resource | Description |
|----------|-------------|
| [Quick Start](docs/guides/QUICKSTART.md) | Get running in 5 minutes |
| [How to Run](docs/guides/HOW_TO_RUN.md) | Detailed setup instructions |
| [Architecture](docs/architecture/INTEGRATION_ARCHITECTURE.md) | System design overview |
| [API Examples](docs/guides/USAGE_EXAMPLES.md) | Code examples |

---

## Overview

Simple web interface for creating WordPress sites using InstaWP templates.

## What This Does

This tool provides an easy-to-use web interface to:

1. Create WordPress sites from InstaWP templates
2. Configure site settings through a simple form
3. Get instant access to your new WordPress site

## Prerequisites

### InstaWP Account
1. Sign up at [InstaWP](https://instawp.com)
2. Go to [API Tokens page](https://app.instawp.io/user/api-tokens)
3. Generate an API key
4. Keep the API key handy (you'll enter it in the web interface)

### Required Software
- Node.js 18+ and npm

## Installation

1. Install dependencies:
```bash
npm install
```

2. (Optional) Configure default settings:
```bash
cp .env.example .env
```

You can optionally set default values in the `.env` file, but you can also enter everything via the web interface.

## Usage

### Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000` (or the port you specified in `.env`).

### Create a Site

1. Open your browser and visit `http://localhost:3000`
2. Fill in the form:
   - **InstaWP API Key**: Your API key from InstaWP dashboard (required)
   - **Template Slug**: The InstaWP template to use (default: flexify)
   - **Site Name**: Optional custom name for your site
   - **Reserve site**: Keep checked to prevent automatic deletion
   - **Make site publicly accessible**: Check if you want the site to be public
3. Click "Create Site"
4. Wait for the site to be created (usually takes 1-2 minutes)
5. Get your new WordPress site URL

## How It Works

### Step-by-Step Process

#### 1. Template Discovery
- Searches InstaWP for the specified template (default: "flexify")
- Retrieves template slug and metadata

#### 2. Site Creation
- Creates WordPress site from template using your API key
- Configures site settings based on your inputs
- Waits for site to become active

#### 3. Site Ready
- Returns site ID and URL
- You can immediately access your WordPress site

### Example Console Output

```
========================================
InstaWP Site Creation
========================================

--- Step 1: Finding InstaWP Template ---
Searching for template with slug: flexify
Found template: Flexify Template

--- Step 2: Creating InstaWP Site from Template ---
Creating site from template: flexify
Site created successfully!
   - Site ID: 45678
   - Site URL: https://site-45678.instawp.xyz

--- Step 3: Waiting for Site to be Ready ---
Site is ready!

========================================
Site Creation Complete!
========================================

Site ID: 45678
Site URL: https://site-45678.instawp.xyz
Template: Flexify Template

Next Steps:
1. Visit your site URL to see your new WordPress site
2. Login to WordPress admin to customize your site
3. You can optionally map a custom domain to your site later
```

## Configuration Options

### Environment Variables (Optional)

You can set defaults in the `.env` file, but they can be overridden via the web interface:

| Variable | Description | Required |
|----------|-------------|----------|
| `INSTA_WP_API_KEY` | InstaWP API token | No (can enter in UI) |
| `TEMPLATE_SLUG` | Default InstaWP template slug | No (default: flexify) |
| `PORT` | Server port | No (default: 3000) |

## Programmatic Usage

You can also use this as a library in your own Node.js projects:

```javascript
import InstaWPSiteCreator from './src/index.js';

const creator = new InstaWPSiteCreator('your-api-key-here');

const result = await creator.createSite({
  templateSlug: 'flexify',  // InstaWP template slug
  siteName: 'My Site',      // Optional site name
  isShared: false,          // Public/private
  isReserved: true,         // Reserve resources
});

if (result.success) {
  console.log('Site created:', result.site.wp_url);
  console.log('Site ID:', result.site.id);
} else {
  console.error('Error:', result.error);
}
```

## Troubleshooting

### API Connection Issues

**InstaWP API errors:**
- Verify API key is valid and correct
- Check your InstaWP account has available resources
- Ensure the template slug exists
- Try using the default template (leave template field empty)

### Site Creation Fails

- Check InstaWP dashboard for account limits
- Verify you have available sites in your plan
- Make sure API key has proper permissions

### Template Not Found

- Use the default template (flexify) by leaving the template slug field empty
- Check InstaWP dashboard for available templates
- Template slugs are case-sensitive

## API Documentation

### InstaWP API
- [InstaWP Documentation](https://docs.instawp.com)
- [API Tokens](https://app.instawp.io/user/api-tokens)
- Postman collection in `docs/api/`

## Project Structure

```
.
├── src/                      # Core application code
│   ├── index.js             # Main InstaWPSiteCreator class
│   ├── server.js            # Express web server & API
│   ├── domain-workflow.js   # Domain registration workflow
│   ├── instawp.js           # InstaWP API client
│   ├── cloudflare.js        # Cloudflare API client
│   ├── namecheap.js         # Namecheap API client
│   └── config.js            # Configuration management
│
├── public/                   # Frontend assets
│   └── index.html           # Web interface
│
├── docs/                     # Documentation
│   ├── guides/              # Setup & usage guides
│   ├── architecture/        # Technical architecture
│   └── api/                 # API collections
```

> Business docs, planning materials, legal agreements, mockups, and plugin archives live in the separate [zero-click-web-waas](https://github.com/MisreadableMind/zero-click-web-waas) repo.

## Security Notes

- Never commit `.env` file to version control
- Keep API keys secure and private
- Rotate API keys periodically
- API keys are sent to the server but never stored
- Run on localhost or secure HTTPS in production

## Support

- InstaWP Support: [InstaWP Docs](https://docs.instawp.com)
- Report issues or request features via GitHub

## License

MIT License - See LICENSE file for details

## Credits

Built with:
- [InstaWP](https://instawp.com) - WordPress hosting and automation
- Node.js, Express.js, Axios
