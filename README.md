# Fundraise Pipeline Tracker

A web app that helps VC firms share investor pipeline lists with portfolio company founders. Export from Attio CRM or create lists manually, then share a link with founders for real-time collaborative editing.

## Features

- **One-click export from Attio** - Pull investor lists directly from your CRM
- **No login required** - Anyone with the link can edit
- **Real-time collaboration** - Multiple users see updates instantly
- **Keyboard navigation** - Tab between cells, Enter to move down rows
- **Dark "hackery" aesthetic** - Easy on the eyes

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + React
- **Database**: Supabase (Postgres + Realtime)
- **CRM Integration**: Attio API
- **Hosting**: Vercel (recommended)

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **SQL Editor** and run the contents of `supabase/migrations/001_initial_schema.sql`
3. Go to **Settings > API** and copy your:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 2. Configure Environment Variables

Copy the example env file:

```bash
cp .env.local.example .env.local
```

Fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ATTIO_API_KEY=your-attio-api-key  # Optional, for Attio integration
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Attio Integration (Optional)

To enable Attio export:

1. Go to your Attio workspace settings
2. Create an API key under **Integrations > API**
3. Add the key to your `.env.local` as `ATTIO_API_KEY`

### Field Mapping

The app maps Attio fields to pipeline fields. You may need to customize `lib/attio.ts` to match your Attio workspace setup:

| Pipeline Field | Default Attio Slug |
|----------------|-------------------|
| name | company_name |
| status | status |
| nextSteps | next_steps |
| notes | notes |
| amount | check_size |
| primaryContact | primary_contact |
| firmContact | owner |

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repo
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Set these in your Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ATTIO_API_KEY` (optional)
- `NEXT_PUBLIC_BASE_URL` (optional, defaults to Vercel URL)

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/lists` | Create a new list with investors |
| GET | `/api/lists/[id]` | Get a list with all investors |
| POST | `/api/lists/[id]/investors` | Add investor to a list |
| PATCH | `/api/investors/[id]` | Update an investor |
| DELETE | `/api/investors/[id]` | Delete an investor |
| GET | `/api/attio/lists` | Get Attio lists (for dropdown) |
| POST | `/api/attio/export` | Export Attio list to our app |

## Usage

### Creating a Pipeline

1. Go to `/export`
2. Either:
   - Select an Attio list and click "Export from Attio"
   - Enter a name and click "Create Empty Pipeline"
3. Copy the shareable link

### Editing a Pipeline

1. Open the pipeline link
2. Click any cell to edit
3. Use keyboard navigation:
   - **Tab** → Next cell in row
   - **Shift+Tab** → Previous cell
   - **Enter** → Same cell, next row
   - **Shift+Enter** → Same cell, previous row
   - **Escape** → Stop editing
4. Changes save automatically and sync in real-time

## License

MIT
