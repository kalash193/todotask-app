# TaskFlow

TaskFlow is now a frontend-only React app.

It includes:

- an `admin` panel
- an `employee` panel
- separate login passwords for both roles
- task assign, update, submit, verify, and reject flows
- browser-only storage with `localStorage`

## Stack

- React
- Vite
- localStorage

## Run

1. Install dependencies with `npm install`.
2. Start the app with `npm run dev`.
3. Open the local Vite URL in your browser.

## Build

Run `npm run build`.

## Demo Logins

- Employee: `employee@taskflow.local` / `employee123`

## Notes

- No backend is required.
- No database is required.
- Data is saved in the current browser only.
- If you clear browser storage, the saved tasks and login session are removed.
