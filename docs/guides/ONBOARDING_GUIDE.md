# InstaWP Site Creation - Onboarding Guide

## What Was Fixed

The **403 "Team not found"** error occurred because the InstaWP API requires a `team_id` parameter when creating sites. The system now automatically:
1. Fetches your available teams
2. Uses your first team as the default
3. Includes the team_id in the site creation request

## How to Use the Onboarding Flow

### Step 1: Start the Server

```bash
npm start
```

The server will start at `http://localhost:3000`

### Step 2: Open Your Browser

Navigate to `http://localhost:3000` and you'll see the site creation form.

### Step 3: Fill Out the Form

#### Required Fields:
- **InstaWP API Key** - Get this from [InstaWP Dashboard → API Tokens](https://app.instawp.io/user/api-tokens)

#### Optional Fields:
- **Template Slug** - Leave blank to use "flexify" (default), or enter a specific template slug
- **Site Name** - Custom name for your site (auto-generated if left blank)
- **Reserve site** - ✅ Checked by default (keeps site active longer)
- **Make site publicly accessible** - ☐ Unchecked by default

### Step 4: Create Your Site

Click "Create Site" and wait 1-2 minutes while the system:
1. **Fetches your default team** (automatically)
2. **Finds the template** you specified
3. **Creates the site** from the template
4. **Waits for the site** to be fully ready

### Step 5: Access Your New Site

Once created, you'll see:
- ✅ **Site ID** - Your unique site identifier
- 🌐 **Site URL** - Click to visit your new WordPress site
- 📋 **Template Name** - Confirmation of which template was used

Click the Site URL to access your new WordPress installation!

## Template Retrieval Flow

The system retrieves templates in this order:

1. **Fetch all templates** from InstaWP API
2. **Search by slug** (exact match)
3. **Search by name** (case-insensitive partial match)
4. **Return the first match**

### Available Templates

To see all available templates, the system fetches from:
```
GET https://app.instawp.io/api/v2/templates
```

Common templates:
- `flexify` (default)
- `hello-elementor`
- `blank` (minimal WordPress)
- And many more available in your InstaWP dashboard

## What Happens Behind the Scenes

### The 4-Step Process:

```
┌─────────────────────────────────────────┐
│ Step 1: Fetch Default Team             │
│ - GET /teams                            │
│ - Selects first available team          │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Step 2: Find Template                   │
│ - GET /templates?page=1&per_page=50     │
│ - Search for specified slug/name        │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Step 3: Create Site                     │
│ - POST /sites/template                  │
│ - Payload includes: slug, team_id,      │
│   is_shared, is_reserved, site_name     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Step 4: Wait for Site Ready             │
│ - Poll GET /sites/{id} every 10 sec     │
│ - Wait for status: 'active' or 'running'│
│ - Timeout: 5 minutes                    │
└─────────────────────────────────────────┘
```

## Troubleshooting

### "No teams found for this account"
- **Solution**: Create a team in your [InstaWP Dashboard](https://app.instawp.io/)
- Every InstaWP account needs at least one team

### "Template with slug 'xxx' not found"
- **Solution**: Check available templates in your InstaWP dashboard
- Try the default: leave the Template Slug field blank
- Common working templates: `flexify`, `hello-elementor`

### "InstaWP API Error: 401 - Unauthorized"
- **Solution**: Check your API key
- Generate a new API key from [API Tokens page](https://app.instawp.io/user/api-tokens)
- Make sure the key has proper permissions

### Site creation times out
- **Normal range**: 30 seconds to 2 minutes
- **Max wait time**: 5 minutes
- **If it fails**: Check InstaWP dashboard to see if site was created
- **Common cause**: InstaWP server overload (try again in a few minutes)

## Next Steps After Site Creation

1. **Visit your site** - Click the Site URL from the success message
2. **Login to WordPress Admin** - Usually at `{your-site-url}/wp-admin`
3. **Get credentials** - Check your InstaWP dashboard for login details
4. **Customize your site** - Install plugins, change themes, create content
5. **Map a custom domain** (optional) - Use the domain mapping features

## Advanced: Using Different Teams

If you have multiple teams in InstaWP and want to use a specific team:

1. The system currently uses your **first team** automatically
2. To use a different team, you would need to modify the code to accept `teamId` as a form input
3. Contact support or check the InstaWP dashboard to see your team IDs

## API Reference

### Endpoints Used:
- `GET /api/v2/teams` - List all teams
- `GET /api/v2/templates` - List templates
- `POST /api/v2/sites/template` - Create site from template
- `GET /api/v2/sites/{id}` - Get site details

### Server Endpoints:
- `POST /api/create-site` - Create new WordPress site
- `GET /api/health` - Server health check

## Environment Variables

Optional configuration in `.env` file:

```env
INSTA_WP_API_KEY=your_api_key_here  # Optional: Pre-fill API key
TEMPLATE_SLUG=flexify                # Optional: Change default template
PORT=3000                            # Optional: Change server port
```

## Support

If you encounter issues:
1. Check the browser console for detailed error messages
2. Check the server console for API request logs
3. Verify your API key permissions in InstaWP dashboard
4. Make sure you have at least one team in your account

Happy site creating! 🚀
