"use client";

import { usePathname } from "next/navigation";
import ProfileAvatar from "./profile-avatar";
import { BrandMark } from "./brand-lockup";

type Props = {
  name: string;
  email: string;
  avatarUrl?: string | null;
};

const links = [
  { href: "/home", label: "Home" },
  { href: "/sessions", label: "Gatherings" },
];

export default function SiteHeader({ name, avatarUrl }: Props) {
  const pathname = usePathname();

  return (
    <header className="site-header sticky top-0 z-40">
      <nav className="site-nav" aria-label="Main navigation">
        <div className="shrink-0">
          <BrandMark />
        </div>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = pathname === link.href ||
              (link.href !== "/home" && pathname.startsWith(link.href));
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`nav-link ${active ? "nav-link-active" : ""}`}
              >
                {link.label}
              </a>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href="/account"
            aria-label="Manage account"
            title="Manage account"
            className="button-secondary !flex !h-9 !w-9 !min-h-9 !shrink-0 !gap-0 !p-0 sm:!h-10 sm:!w-auto sm:!min-h-10 sm:!gap-2 sm:!px-4 sm:!py-2"
          >
            <ProfileAvatar name={name} avatarUrl={avatarUrl} size="sm" />
            <span className="hidden sm:inline">Manage account</span>
          </a>
          <details className="mobile-nav shrink-0 md:hidden">
            <summary aria-label="Open navigation" aria-haspopup="true"><span aria-hidden="true" className="text-lg">☰</span></summary>
            <div className="mobile-nav-panel" aria-label="Mobile navigation">
              {links.map((link) => {
                const active = pathname === link.href || (link.href !== "/home" && pathname.startsWith(link.href));
                return <a key={link.href} href={link.href} aria-current={active ? "page" : undefined}>{link.label}</a>;
              })}
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
