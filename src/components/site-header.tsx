"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ProfileAvatar from "./profile-avatar";

type Props = {
  name: string;
  email: string;
  avatarUrl?: string | null;
};

const links = [
  { href: "/home", label: "Home" },
  { href: "/sessions", label: "Gatherings" },
  { href: "/account", label: "Profile" },
];

export default function SiteHeader({ name, email, avatarUrl }: Props) {
  const pathname = usePathname();

  return (
    <header className="site-header sticky top-0 z-40">
      <nav className="site-nav" aria-label="Main navigation">
        <Link href="/" className="brand-lockup" aria-label="Vaani home">
          <span className="brand-word">Vaani</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = pathname === link.href ||
              (link.href !== "/home" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`nav-link ${active ? "nav-link-active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <details className="profile-menu">
            <summary aria-label="Open profile menu">
              <ProfileAvatar name={name} avatarUrl={avatarUrl} size="sm" />
              <span className="hidden max-w-32 truncate text-sm font-medium text-[var(--ink)] sm:block">{name}</span>
              <span aria-hidden="true" className="text-xs text-[var(--muted)]">⌄</span>
            </summary>
            <div className="profile-dropdown">
              <div className="border-b border-[var(--line)] px-4 py-3">
                <p className="truncate text-sm font-semibold text-[var(--ink)]">{name}</p>
                <p className="truncate text-xs text-[var(--muted)]">{email}</p>
              </div>
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="profile-dropdown-link">{link.label}</Link>
              ))}
            </div>
          </details>
          <details className="mobile-nav md:hidden">
            <summary aria-label="Open navigation"><span aria-hidden="true" className="text-lg">☰</span></summary>
            <div className="mobile-nav-panel">
              {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
              <Link href="/">Vaani home</Link>
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
