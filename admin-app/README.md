# JCIT Admin App

This is a separate admin build for migrating `JCIT Team Management v1` from Google Sheets into Supabase. It does not depend on, import from, or change the existing `TiTo` production app.

## What Is Included

- `index.html`, `styles.css`, `app.js`: standalone admin interface.
- `supabase/migrations/202606300001_admin_schema.sql`: Supabase schema and RLS policies.
- `scripts/migrate-sheet-to-supabase.mjs`: Google Sheets to Supabase importer.
- `scripts/create-supabase-project.mjs`: optional Supabase Management API bootstrap helper.

## Local Preview

```sh
cd admin-app
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173`.

The browser app stores the Supabase URL and anon key in `localStorage` for local development. Do not paste a service role key into the browser.

## Supabase Setup

1. Create a new Supabase project.
2. Run `supabase/migrations/202606300001_admin_schema.sql` in the SQL editor.
3. Create or invite manager users in Supabase Auth.
4. Link each manager user to the imported employee row by setting `employees.auth_user_id`.
5. Use the migration script with `SUPABASE_SERVICE_ROLE_KEY` to import sheet data.

The migration script skips the old plain-text portal passwords. Passwords should be reset through Supabase Auth.

## Migration

Create `admin-app/.env.local` from `.env.example`, then run:

```sh
node scripts/migrate-sheet-to-supabase.mjs
```

The script reads from the Google Sheet, upserts normalized records into Supabase, and stores per-row source references in `source_row_mappings`.
