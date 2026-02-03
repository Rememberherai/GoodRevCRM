# CLAUDE.md

## Database

Database pushes to Supabase must be run with the explicit connection string:

```bash
npx supabase db push --db-url 'postgresql://postgres.oljvcakgpksulsszojgx:@Cbz.BzDh9LN@rt@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
```

### Pooler prepared statement workaround

The Supabase Supavisor connection pooler (port 6543) often hits a `prepared statement "lrupsc_1_0" already exists` error. Before running `db push`, deallocate stale prepared statements:

```bash
node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.oljvcakgpksulsszojgx:@Cbz.BzDh9LN@rt@aws-0-us-west-2.pooler.supabase.com:6543/postgres' });
c.connect().then(() => c.query('DEALLOCATE ALL')).then(() => { console.log('Deallocated'); return c.end(); }).catch(e => { console.error(e.message); c.end(); });
"
```

This requires the `pg` npm package (`npm install --no-save pg`). Run the deallocate, then immediately run `db push`.

### Migration notes

- The `updated_at` trigger function is called `handle_updated_at()` (defined in `0001_users.sql`). Use this name in all new migrations.
- Use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` in migrations to make them idempotent where possible.
