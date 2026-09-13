"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/",
    label: "交给它",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    href: "/river",
    label: "时间线",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M4 7c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2M4 15c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/letter",
    label: "信",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function Nav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* 桌面:顶部导航 */}
      <header className="sticky top-0 z-40 hidden border-b border-sea-mist bg-paper/90 backdrop-blur md:block">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-8">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-wide text-sea-deep">致你</span>
            <span className="font-letter text-sm italic text-ink-soft">Dear You</span>
          </Link>
          <nav className="flex items-center gap-8">
            {ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm transition-colors ${
                  isActive(item.href)
                    ? "text-sea"
                    : "text-ink-soft hover:text-sea-deep"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* 手机:底部 Tab */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sea-mist bg-paper/95 backdrop-blur md:hidden">
        <div className="flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          {ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs ${
                  active ? "text-sea" : "text-ink-soft"
                }`}
              >
                <span className="h-6 w-6">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
