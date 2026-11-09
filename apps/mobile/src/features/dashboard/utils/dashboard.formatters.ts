export function formatRupees(paise: number, withSign = false): string {
  const sign = paise < 0 ? "-" : withSign && paise > 0 ? "+" : "";
  return `${sign}₹${new Intl.NumberFormat("en-IN").format(Math.abs(paise) / 100)}`;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value));
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

export function relativeActivityDate(value: string | null): string {
  return value ? formatDate(value) : "No activity yet";
}
