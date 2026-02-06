# Fundraise App Setup Guide

This guide will walk you through setting up the Fundraise Tracker with full authentication and semantic URLs.

## Overview of Changes

This implementation transforms the fundraise tracker from a single-user app into a professional multi-user platform:

- **Hybrid Authentication**: Login required to create pipelines, but shareable links work anonymously
- **Semantic URLs**: Human-readable links like `/list/acme-series-a` instead of UUIDs
- **User Dashboard**: View and manage all your pipelines in one place
- **Mobile Support**: Responsive design for viewing on phones and tablets
- **Professional UI**: Toast notifications, loading states, and polished interactions

## Prerequisites

- Node.js 18+ installed
- Access to the Supabase project dashboard
- Google Cloud Console account (for OAuth)

## Step 1: Install Dependencies

```bash
npm install @supabase/ssr
```

## Step 2: Run Database Migration

1. Open your Supabase project dashboard: https://supabase.com/dashboard/project/nbzywrafzhckfwmutohq
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/005_add_auth_and_slugs.sql`
4. Click **Run** to execute the migration

The migration will:
- Add `user_id` and `slug` columns to the `lists` table
- Create indexes for performance
- Enable Row Level Security (RLS) on both `lists` and `investors` tables
- Create security policies that allow:
  - Anyone to view/edit lists (via shareable links)
  - Only authenticated users to create lists
  - Only list owners to delete their lists
- Add auto-updating `updated_at` timestamp

## Step 3: Configure Google OAuth

### 3.1 Create Google OAuth Application

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth 2.0 Client ID**
5. If prompted, configure the OAuth consent screen:
   - User Type: **External**
   - App name: **Fundraise Tracker**
   - User support email: Your email
   - Developer contact: Your email
   - Save and continue through the scopes (no scopes needed for basic profile)
6. Return to creating OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Name: **Fundraise Tracker**
   - Authorized redirect URIs:
     - Add: `https://nbzywrafzhckfwmutohq.supabase.co/auth/v1/callback`
   - Click **CREATE**
7. Copy the **Client ID** and **Client Secret** (you'll need these next)

### 3.2 Configure Google Provider in Supabase

1. Open Supabase Dashboard → **Authentication** → **Providers**
2. Find **Google** in the list and click to expand
3. Enable the Google provider toggle
4. Paste your **Client ID** from Google
5. Paste your **Client Secret** from Google
6. Set the redirect URL to: `https://nbzywrafzhckfwmutohq.supabase.co/auth/v1/callback`
7. Configure allowed redirect URLs:
   - Development: `http://localhost:3000/`
   - Production: `https://your-domain.com/` (when deploying)
8. Click **Save**

### 3.3 Test OAuth (Optional but Recommended)

Before proceeding, test that OAuth is working:

1. Start the dev server: `npm run dev`
2. Navigate to http://localhost:3000/login
3. Click **Sign in with Google**
4. You should be redirected to Google's login page
5. After authorizing, you should be redirected back to `/dashboard`

If this doesn't work, double-check:
- The redirect URI in Google Cloud Console matches Supabase exactly
- The Client ID and Secret are correct in Supabase
- You've saved the settings in both Google and Supabase

## Step 4: Environment Variables

Your `.env.local` file should already have these (no changes needed):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://nbzywrafzhckfwmutohq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

Optional for production:
```bash
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## Step 5: Start the Development Server

```bash
npm run dev
```

Navigate to http://localhost:3000

## How to Use the New Features

### Creating a Pipeline (Requires Login)

1. Go to http://localhost:3000/export
2. If not logged in, you'll be redirected to `/login`
3. Sign in with Google
4. Import from CSV or Attio as usual
5. Your list will have a semantic URL like `/list/acme-series-a`
6. You'll be redirected to the CRM page

### Dashboard

1. After logging in, go to http://localhost:3000/dashboard
2. See all pipelines you've created
3. View investor counts by status for each pipeline
4. Quick actions: Copy shareable link, Open pipeline
5. Click "Create Pipeline" to go to the import page

### Sharing Pipelines (No Login Required)

1. From the dashboard or CRM page, click "Copy Link"
2. Share the link with founders or team members
3. Recipients can view and edit WITHOUT logging in
4. Edits are saved in real-time

### URL Structure

- **Old**: `/list/550e8400-e29b-41d4-a716-446655440000`
- **New**: `/list/acme-series-a`

If you rename a list, the slug automatically updates!

## Architecture Overview

### Authentication Flow

```
User visits /export
    ↓
Middleware checks auth
    ↓
Not logged in? → Redirect to /login
    ↓
Click "Sign in with Google"
    ↓
Redirect to Google OAuth
    ↓
User authorizes
    ↓
Redirect to /auth/callback
    ↓
Exchange code for session
    ↓
Redirect to /dashboard
```

### Slug Generation

```
User creates list "Acme Series A"
    ↓
POST /api/lists with name
    ↓
Generate slug: "acme-series-a"
    ↓
Check if slug exists in DB
    ↓
If exists, append -2, -3, etc.
    ↓
Save list with unique slug
    ↓
Return URL: /list/acme-series-a
```

### Security Model (RLS)

**Lists Table**:
- **SELECT**: Anyone (enables shareable links)
- **UPDATE**: Anyone (enables editing via links)
- **INSERT**: Authenticated users only (user_id = auth.uid())
- **DELETE**: Owner only (user_id = auth.uid())

**Investors Table**:
- **All operations**: Anyone (tied to parent list permissions)

This hybrid model allows:
- Secure pipeline creation (requires login)
- Flexible sharing (no login needed to view/edit)
- Owner-only deletion (prevent accidental data loss)

## File Structure

### New Files Created

```
lib/
  auth.ts                    # Server-side auth helpers
  slug.ts                    # Slug generation utilities

app/
  login/
    page.tsx                 # Google OAuth login page
  dashboard/
    page.tsx                 # User dashboard
  auth/
    callback/
      route.ts               # OAuth callback handler

components/
  Toast.tsx                  # Toast notification system
  ConfirmDialog.tsx          # Confirmation modal
  LoadingSkeleton.tsx        # Loading placeholder

middleware.ts                # Auth middleware for protected routes

supabase/
  migrations/
    005_add_auth_and_slugs.sql  # Database migration
```

### Modified Files

```
lib/
  supabase.ts                # Added SSR client with cookies

app/
  layout.tsx                 # Added viewport meta tag
  list/[slug]/page.tsx       # Renamed from [id], uses slug
  api/
    lists/
      route.ts               # Added GET for user lists, POST requires auth
      [slug]/
        route.ts             # Renamed from [id], added DELETE
        investors/
          route.ts           # Updated to use slug

components/
  FundraiseTracker.tsx       # Added listSlug prop, fixed TypeScript
```

## Troubleshooting

### "Unauthorized" error when creating lists
- Ensure you're logged in
- Check that the database migration ran successfully
- Verify RLS policies are active in Supabase

### Google OAuth redirect fails
- Double-check redirect URI in Google Cloud Console
- Ensure it matches exactly: `https://nbzywrafzhckfwmutohq.supabase.co/auth/v1/callback`
- Check that Client ID and Secret are correct in Supabase

### Slug collision errors
- The slug generator automatically handles collisions by appending -2, -3, etc.
- If you see errors, check the `idx_lists_slug` index exists

### Can't access lists created before migration
- Old lists won't have a `slug` or `user_id`
- They can still be accessed via UUID (if you have the link)
- To migrate old lists, manually add slugs and assign to a user

### TypeScript errors
- Run `npx tsc --noEmit` to check for errors
- Most errors have been fixed, but if you see new ones, check that all Supabase client calls use `await`

## Testing Checklist

- [ ] Can sign in with Google
- [ ] Can create a new list (requires login)
- [ ] List has semantic URL (e.g., `/list/acme-series-a`)
- [ ] Dashboard shows only my lists
- [ ] Can copy shareable link from dashboard
- [ ] Shareable link works in incognito (no login)
- [ ] Can edit investors via shareable link
- [ ] Can't see other users' lists in dashboard
- [ ] Can delete my own lists
- [ ] Toast notifications work
- [ ] Mobile view is responsive

## Next Steps

1. **Deploy to Production**:
   - Update Google OAuth redirect URIs to include production domain
   - Set `NEXT_PUBLIC_BASE_URL` environment variable
   - Deploy to Vercel/Netlify

2. **Add More Features**:
   - List rename functionality in CRM header
   - Advanced filtering and search in dashboard
   - Export to PDF
   - Email notifications

3. **Backfill Existing Data** (if needed):
   ```sql
   -- Assign all existing lists to a specific user
   UPDATE lists SET user_id = 'your-user-id' WHERE user_id IS NULL;

   -- Generate slugs for existing lists
   UPDATE lists SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL;
   ```

## Support

For issues or questions:
- Check `IMPLEMENTATION_STATUS.md` for detailed implementation notes
- Review migration file for database schema details
- Consult Supabase docs for RLS policy syntax

---

**Congratulations!** Your fundraise tracker is now a professional multi-user platform. 🚀
