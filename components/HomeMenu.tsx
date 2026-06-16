import Link from "next/link";

// One tidy menu (gear) instead of a cluttered row of links. Server component —
// uses native <details> so it needs no client JS.
export function HomeMenu() {
  const items = [
    { href: "/tasks", label: "Plan" },
    { href: "/earnings", label: "Earnings" },
    { href: "/coach", label: "Coach" },
    { href: "/settings", label: "Settings" },
  ];
  return (
    <details className="relative">
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-hairline text-text active:bg-white/10">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-card border border-hairline bg-bg shadow-xl">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="block px-4 py-2.5 text-sm text-text active:bg-white/10">
            {it.label}
          </Link>
        ))}
        <form action="/auth/signout" method="post" className="border-t border-hairline">
          <button type="submit" className="block w-full px-4 py-2.5 text-left text-sm text-risk active:bg-white/10">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
