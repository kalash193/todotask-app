# PHP Hosting Deploy

## Upload Layout

Upload the contents of `public_html/` into your hosting account's `public_html` folder.

Keep `.env` one level above `public_html` when your host allows it.

Example:

```text
account-root/
  .env
  public_html/
    index.html
    assets/
    api/
      index.php
      bootstrap.php
      .htaccess
```

If your host does not allow `.env` above `public_html`, place it inside `public_html/.env`.

## .env

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=taskflow_app
DB_USER=your_db_user
DB_PASS=your_db_password
```

## First-time Setup

1. Upload files.
2. Create a MySQL database in your hosting panel.
3. Update `.env` with the hosting database details.
4. Open `/api/setup.php` once in the browser or run it from the host terminal if available.
5. Delete or protect `api/setup.php` after setup.

## Demo Logins

- Admin: `admin@taskflow.local` / `admin123`
- Employee: `employee@taskflow.local` / `employee123`
