# TaskFlow

React frontend with:

- a Vercel-compatible Node serverless backend
- a PHP hosting package for shared hosting

## Stack

- React + Vite
- Vercel Node Functions
- Vercel Blob for deployed server-side storage
- PHP 8.2 + MySQL package for shared hosting fallback

## Local Setup

1. Copy `.env.example` to `.env`.
2. Update the MySQL values in `.env`.
3. Run `npm run db:setup`.
4. Start the PHP API with `npm run server`.
5. Start the React frontend with `npm run dev`.

## Vercel Deploy

1. Import this repo into Vercel.
2. Add a Vercel Blob store to the project and redeploy.
3. Redeploy.

The `/api` backend uses Vercel Functions and stores auth/tasks in Blob in production.
If Blob is not configured, Vercel production requests will fail because serverless functions do not have persistent local storage. Local development still falls back to `data/vercel-db.json`.

## Demo Logins

- Email: `admin@taskflow.local`
- Password: `admin123`
- Email: `employee@taskflow.local`
- Password: `employee123`

## Notes

- The frontend talks to the backend through `/api`.
- Vite proxies `/api` to `http://127.0.0.1:8000`.
- On Vercel, task data is stored in Vercel Blob.
- On the PHP hosting package, task data is stored in MySQL.
- If you prefer manual SQL setup, `database/schema.sql` and `database/seed.sql` are still included.
