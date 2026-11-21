"use client";

import { usePathname } from "next/navigation";
import ProfileAvatar from "./profile-avatar";
import { BrandMark } from "./brand-lockup";
import InstallVaani from "./install-vaani";

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
        <BrandMark />

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

        <div className="flex items-center gap-2">
          <InstallVaani />
          <a href="/account" className="button-secondary !min-h-9 !gap-2 !px-3 !py-1.5 text-xs sm:!min-h-10 sm:!px-4 sm:!py-2 sm:text-sm">
            <ProfileAvatar name={name} avatarUrl={avatarUrl} size="sm" />
            <span>Manage account</span>
          </a>
          <details className="mobile-nav md:hidden">
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
