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

### Post-migration workflow

**CRITICAL**: After every Supabase migration, you MUST:

1. **Regenerate TypeScript types**:
   ```bash
   npx supabase gen types typescript --db-url 'postgresql://postgres.oljvcakgpksulsszojgx:@Cbz.BzDh9LN@rt@aws-0-us-west-2.pooler.supabase.com:6543/postgres' > types/database.ts
   ```

2. **Run typecheck to catch breaking changes**:
   ```bash
   npm run typecheck
   ```

3. **Fix any type errors** that arise from schema changes (e.g., new required fields, renamed columns, type mismatches).

4. **Commit both the migration and type fixes together** to keep the codebase in sync with the database schema.

This ensures type safety and catches issues at compile time rather than runtime.

## Automation considerations

When building new features, always consider adding automation support:
- **Triggers**: Emit automation events via `emitAutomationEvent()` in API routes after entity mutations (create, update, delete). The call is non-blocking (fire-and-forget with error logging).
- **Actions**: If the feature creates a new action type, add a handler to `lib/automations/actions.ts` and register the type in `types/automation.ts`.
- **Time-based triggers**: If the feature introduces a new time-based condition (e.g. "X days since last Y"), add it to `lib/automations/time-triggers.ts`.
- **See**: `lib/automations/engine.ts` for the automation system architecture.

## Git commits

When committing to git, unless otherwise noted, only commit file changes from the current chat session. Exclude changes that were made elsewhere outside the current chat context.

## Tracking incomplete work

When something is left undone during a session (e.g., a feature partially implemented, a bug not fully fixed, or a task deferred), add a TODO item using the TodoWrite tool and also log it in `/docs/TODO.md` so it can be tracked across sessions.
