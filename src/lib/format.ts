export function formatFullDate(date: string): string | null {
  const parsed = new Date(`${date}T12:00:00`);
  if (!date || Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// A field only earns a place on the page when it resolves to a real value —
// a schema having a slot for "release timeline" isn't a reason to show a row
// of TBAs (TMDb's release_dates entries aren't always populated for every
// type/region). Entries that can't resolve to a real date are dropped rather
// than falling back to a placeholder string.
export function filterReleaseTimeline(entries: Array<{ type: string; date: string }>): Array<{ type: string; date: string }> {
  return entries
    .map((entry) => ({ type: entry.type, date: formatFullDate(entry.date) }))
    .filter((entry): entry is { type: string; date: string } => entry.date !== null);
}
