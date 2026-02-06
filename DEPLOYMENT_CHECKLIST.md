# Deployment Checklist

Use this checklist before deploying to production.

## Pre-Deployment

### Database
- [ ] Run migration `005_add_auth_and_slugs.sql` in production Supabase
- [ ] Verify RLS policies are active on `lists` and `investors` tables
- [ ] Check indexes exist: `idx_lists_user_id`, `idx_lists_slug`
- [ ] Test with sample data (create list, share link, delete list)

### Google OAuth
- [ ] Production domain added to Google Cloud Console redirect URIs
  - Format: `https://nbzywrafzhckfwmutohq.supabase.co/auth/v1/callback`
- [ ] Supabase Google provider has correct Client ID and Secret
- [ ] Allowed redirect URLs in Supabase include production domain

### Environment Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set correctly
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set correctly
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (server-side only)
- [ ] `NEXT_PUBLIC_BASE_URL` set to production domain

### Code
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No console errors in dev mode
- [ ] Build succeeds (`npm run build`)
- [ ] All dependencies installed (`npm install`)

## Testing (Pre-Production)

### Authentication
- [ ] Can sign in with Google
- [ ] Session persists after page refresh
- [ ] Can log out successfully
- [ ] Redirects to `/login` when accessing `/export` without auth
- [ ] Redirects to `/dashboard` after successful login

### List Creation
- [ ] Can create list from CSV import
- [ ] Can create list from Attio import
- [ ] List has semantic slug (e.g., `acme-series-a`)
- [ ] Slug collision handling works (creates `name-2`, `name-3`, etc.)
- [ ] User ID is saved correctly

### Dashboard
- [ ] Dashboard shows only current user's lists
- [ ] Investor counts display correctly
- [ ] "Last modified" times are accurate
- [ ] Copy link button works (toast notification shows)
- [ ] Open button navigates to correct slug
- [ ] Empty state shows when no lists exist
- [ ] User profile displays (avatar, name, email)

### Shareable Links
- [ ] Can copy link from dashboard
- [ ] Link works in incognito browser (no login required)
- [ ] Can view all investors via shared link
- [ ] Can edit investors via shared link
- [ ] Changes save successfully without auth
- [ ] Real-time sync works

### Permissions
- [ ] User A cannot see User B's lists in dashboard
- [ ] User A cannot delete User B's lists via API
- [ ] User A CAN view User B's list via shared link
- [ ] User A CAN edit User B's investors via shared link

### Mobile
- [ ] Dashboard renders correctly on mobile
- [ ] CRM page is scrollable horizontally on mobile
- [ ] Touch targets are adequate (44x44px minimum)
- [ ] Login page works on mobile
- [ ] Modals don't overflow on small screens

### UI/UX
- [ ] Toast notifications appear and dismiss correctly
- [ ] No broken images or icons
- [ ] Theme toggle works (dark/light mode)
- [ ] Loading states show during data fetching
- [ ] Error states display helpful messages
- [ ] Empty states are welcoming

## Deployment

### Platform: Vercel (Recommended)

1. **Connect Repository**
   ```bash
   vercel
   ```

2. **Configure Environment Variables**
   - In Vercel dashboard, add all environment variables
   - Ensure `NEXT_PUBLIC_BASE_URL` points to your Vercel domain

3. **Deploy**
   ```bash
   vercel --prod
   ```

4. **Update Google OAuth**
   - Add Vercel domain to Google Cloud Console redirect URIs
   - Format: `https://your-app.vercel.app`
   - Update Supabase Google provider allowed redirect URLs

### Platform: Netlify (Alternative)

1. **Connect Repository**
   - Link GitHub repo in Netlify dashboard

2. **Build Settings**
   - Build command: `npm run build`
   - Publish directory: `.next`

3. **Environment Variables**
   - Add all env vars in Netlify dashboard

4. **Update Google OAuth** (same as Vercel)

## Post-Deployment

### Verification
- [ ] Can access production URL
- [ ] Can sign in with Google (production domain)
- [ ] Can create a list and view it
- [ ] Shareable links work from production
- [ ] Dashboard loads correctly
- [ ] No console errors in browser
- [ ] API routes respond correctly

### Monitoring
- [ ] Set up Sentry or error tracking (optional)
- [ ] Enable Vercel/Netlify analytics (optional)
- [ ] Monitor Supabase usage/quotas

### Documentation
- [ ] Update README with production URL
- [ ] Document any production-specific configuration
- [ ] Share setup guide with team

## Rollback Plan

If something goes wrong:

1. **Code Issues**:
   ```bash
   vercel --prod --rollback
   ```

2. **Database Issues**:
   - Revert migration (if needed):
     ```sql
     -- Drop new columns
     ALTER TABLE lists DROP COLUMN IF EXISTS user_id;
     ALTER TABLE lists DROP COLUMN IF EXISTS slug;
     ALTER TABLE lists DROP COLUMN IF EXISTS updated_at;

     -- Disable RLS
     ALTER TABLE lists DISABLE ROW LEVEL SECURITY;
     ALTER TABLE investors DISABLE ROW LEVEL SECURITY;
     ```

3. **OAuth Issues**:
   - Double-check redirect URIs
   - Regenerate Client ID/Secret if compromised
   - Disable Google provider temporarily

## Production Best Practices

### Security
- [ ] Never expose `SUPABASE_SERVICE_ROLE_KEY` to client
- [ ] Use HTTPS everywhere
- [ ] Enable 2FA on Google Cloud Console
- [ ] Enable 2FA on Supabase account
- [ ] Regularly rotate Google OAuth credentials

### Performance
- [ ] Enable CDN caching for static assets
- [ ] Monitor API response times
- [ ] Watch for slow database queries
- [ ] Optimize images if needed

### Backups
- [ ] Supabase automatic backups are enabled (check dashboard)
- [ ] Export data periodically as backup
- [ ] Document recovery procedures

## Common Production Issues

### "Unauthorized" errors
- Check RLS policies are correct
- Verify service role key is set server-side
- Ensure middleware is working

### OAuth redirect fails
- Redirect URI must match exactly (no trailing slash)
- Check Google Cloud Console settings
- Verify Supabase provider configuration

### Slow performance
- Check database indexes exist
- Monitor Supabase connection pool
- Consider upgrading Supabase tier if needed

### Data inconsistencies
- Old lists might not have slugs - backfill if needed
- Missing user_id on lists - assign to specific user

## Maintenance

### Weekly
- [ ] Check error logs
- [ ] Monitor Supabase usage
- [ ] Verify backups are running

### Monthly
- [ ] Review Google OAuth usage
- [ ] Check for dependency updates
- [ ] Review and clean up old data

### Quarterly
- [ ] Rotate Google OAuth credentials
- [ ] Review and update RLS policies if needed
- [ ] Performance audit

---

**Ready to deploy?** Follow this checklist step by step to ensure a smooth production launch. ✨
