# TaskFlow

React frontend with a PHP backend and MySQL storage.

## Stack

- React + Vite
- PHP 8.2
- MySQL

## Setup

1. Copy `.env.example` to `.env`.
2. Update the MySQL values in `.env`.
3. Run `npm run db:setup`.
4. Start the PHP API with `npm run server`.
5. Start the React frontend with `npm run dev`.

## Vercel

This project uses:

- React frontend
- PHP backend
- MySQL database

The frontend can be deployed on Vercel, but the PHP backend should be deployed on a PHP host, not on Vercel's standard setup.

For Vercel frontend deployment:

1. Deploy the React app to Vercel.
2. Deploy the `php-backend` folder to a PHP-capable host.
3. In Vercel Project Settings, add:
   `VITE_API_BASE_URL=https://your-backend-domain.com/api`

Without `VITE_API_BASE_URL`, the deployed frontend will try to call `/api` on Vercel itself and requests will fail.

## Demo Logins

- Email: `admin@taskflow.local`
- Password: `admin123`
- Email: `employee@taskflow.local`
- Password: `employee123`

## Notes

- The frontend talks to the backend through `/api`.
- Vite proxies `/api` to `http://127.0.0.1:8000`.
- User and todo data are stored in MySQL.
- If you prefer manual SQL setup, `database/schema.sql` and `database/seed.sql` are still included.
