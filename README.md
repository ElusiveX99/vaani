# Vaani

Vaani is a gathering space for Sakhis to come together for Shree Hit Chaturasi Ji gaayan, pada gaayan, and shared Vaani paath.

It brings the practical parts of a gathering into one place: arranging a time, sharing an invitation, meeting together, and following the Vaani as it is read.

**Live site:** https://vaaniju.vercel.app

## What you can do

- Save a gathering as a draft or publish it for a future time.
- Share a gathering with Vaani members or through a secure invitation link.
- Set a waiting room, participant limit, duration, repeat schedule, and participant instructions.
- Meet using live audio and video, with organizer and session-admin controls.
- Follow a synchronized PDF reader during Vaani paath.
- Use gathering chat, membership controls, join requests, and notifications.

## The conference room

The conference room is designed around shared reading rather than screen sharing.

- LiveKit provides real-time audio and video.
- Supabase Realtime distributes gathering and reader-state changes.
- PDF.js, through `react-pdf`, renders the shared document.
- The organizer or an authorized reader can control the shared page and reading position.
- Participants can navigate locally and return to the shared position when they are ready.

## Technology

- Next.js 16, React 19, and TypeScript
- Tailwind CSS 4
- Supabase Auth, Postgres, Storage, and Realtime
- LiveKit
- PDF.js via `react-pdf`
- Vercel

## Run locally

Use Node.js 26 LTS and npm.

```bash
git clone https://github.com/ElusiveX99/vaani.git
cd vaani
npm install
```

Create `.env.local` in the project root:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

Fill in the values for your Supabase and LiveKit projects. Keep private keys on the server and do not commit `.env.local`.

Start the app:

```bash
npm run dev
```

Open http://localhost:3000.

## Commands

```bash
npm run dev       # Development server
npm run build     # Production build
npm run start     # Run the production build
npm run lint      # ESLint
```

## Database

Database changes live in `supabase/migrations`. Apply migrations in order to the Supabase project used by the deployment. Once a migration has been applied, make future schema changes in a new migration rather than rewriting history.

RLS and database functions enforce gathering membership, invitation redemption, waiting-room approval, and session permissions. Keep authorization checks in the database; hiding a control in the interface is not an access-control boundary.

## Invitation links

Invitation URLs use short codes, while the database stores token hashes for lookup. Links can have an expiry and a maximum number of uses, and can be revoked by their creator or a gathering manager. The invitation page shows the gathering details before asking a visitor to sign in.

A gathering with a waiting room still requires organizer approval after an invitation is redeemed. The invitation does not bypass that approval.

## Deployment

The production site is hosted on Vercel from the `main` branch.

Set the environment variables above in Vercel. Add the production authentication callback to the Supabase Auth redirect allow list:

`https://vaaniju.vercel.app/auth/callback`

For local email sign-in, also allow:

`http://localhost:3000/auth/callback`

Set `NEXT_PUBLIC_SITE_URL` to the canonical origin for the environment so invitation links and social previews use the right host.

जय जय श्री हित हरिवंश
