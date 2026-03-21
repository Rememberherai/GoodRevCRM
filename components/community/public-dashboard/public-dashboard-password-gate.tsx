export function PublicDashboardPasswordGate({
  action,
  title,
  error,
}: {
  action: string;
  title: string;
  error?: string | null;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">This published dashboard is password protected.</p>
      <form action={action} method="POST" className="mt-6 space-y-4">
        <label className="block space-y-2 text-sm">
          <span>Password</span>
          <input
            type="password"
            name="password"
            className="w-full rounded-md border px-3 py-2"
            required
          />
        </label>
        {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <button type="submit" className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          View Dashboard
        </button>
      </form>
    </div>
  );
}
