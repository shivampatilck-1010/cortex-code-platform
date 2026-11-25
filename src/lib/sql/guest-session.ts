export function getGuestSqlProjectId(): string {
  if (typeof window === 'undefined') return 'sandbox_sql_default';
  const storageKey = 'cortex_sql_sandbox_id';
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing && /^[a-zA-Z0-9_-]{4,64}$/.test(existing)) {
      return existing;
    }
    const created = `sandbox_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return 'sandbox_sql_default';
  }
}
