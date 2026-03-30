// Date formatting utilities

/** Format a civil calendar day in the viewer's locale (no timezone shift). */
function formatYmdLocalCalendar(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const local = new Date(y, mo - 1, d);
  if (
    local.getFullYear() !== y ||
    local.getMonth() !== mo - 1 ||
    local.getDate() !== d
  ) {
    return null;
  }
  return local.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Airtable (and many APIs) send birthdays as `YYYY-MM-DD` with no timezone.
 * `new Date("1988-08-08")` is parsed as UTC midnight, so `toLocaleDateString` in
 * Americas timezones shows the previous calendar day (e.g. Aug 7). For date-only
 * strings, interpret as a civil calendar date in the viewer's locale.
 */
function formatDateOnlyCalendarString(ymd: string): string | null {
  if (typeof ymd !== "string") return null;
  const m = ymd.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  return formatYmdLocalCalendar(
    parseInt(m[1]!, 10),
    parseInt(m[2]!, 10),
    parseInt(m[3]!, 10),
  );
}

/** Use UTC calendar components so API instants like `…T00:00:00.000Z` match Airtable's day. */
function formatUtcInstantAsLocalCalendarLabel(d: Date): string {
  const cal = formatYmdLocalCalendar(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
  );
  return cal ?? "Invalid date";
}

/**
 * Birthdays from rollups / APIs often arrive as `1988-08-08T00:00:00.000Z` or epoch ms at
 * UTC midnight — both would show the wrong local day with plain `formatDate`.
 */
export function formatDateOfBirth(
  dateInput: string | number | Date | null | undefined,
): string {
  if (dateInput == null || dateInput === "") return "N/A";

  if (typeof dateInput === "string") {
    const t = dateInput.trim();
    const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s].*)/);
    if (iso) {
      const cal = formatYmdLocalCalendar(
        parseInt(iso[1]!, 10),
        parseInt(iso[2]!, 10),
        parseInt(iso[3]!, 10),
      );
      if (cal) return cal;
    }
    try {
      const d = new Date(t);
      if (Number.isNaN(d.getTime())) return "Invalid date";
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  }

  try {
    const d = new Date(dateInput as number | Date);
    if (Number.isNaN(d.getTime())) return "Invalid date";
    return formatUtcInstantAsLocalCalendarLabel(d);
  } catch {
    return "Invalid date";
  }
}

/** Airtable/API may send dates as `YYYY-MM-DD` strings, epoch ms numbers, or Date values. */
export function formatDate(
  dateInput: string | number | Date | null | undefined,
): string {
  if (dateInput == null || dateInput === "") return "N/A";

  if (typeof dateInput === "string") {
    const calendar = formatDateOnlyCalendarString(dateInput);
    if (calendar) return calendar;
  }

  try {
    const date = new Date(dateInput as string | number | Date);
    if (Number.isNaN(date.getTime())) return "Invalid date";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Invalid date";
  }
}

/** Format ISO date string as date and time (e.g. "Jan 15, 2025 at 2:30 PM"). */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (e) {
    return '—';
  }
}

export function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return 'No activity yet';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months !== 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years !== 1 ? 's' : ''} ago`;
    }
  } catch (e) {
    return 'Invalid date';
  }
}

export function getRelativeDate(daysAgo: number, hoursAgo: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - hoursAgo);
  return date.toISOString();
}
