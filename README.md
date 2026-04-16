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
