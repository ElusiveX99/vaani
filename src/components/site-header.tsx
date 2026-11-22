"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ProfileAvatar from "./profile-avatar";
import { BrandMark } from "./brand-lockup";

type Props = {
  name: string;
  email: string;
  avatarUrl?: string | null;
};

const links = [
  { href: "/home", label: "Home", symbol: "⌂" },
  { href: "/sessions", label: "Gatherings", symbol: "◷" },
];

function isActive(pathname: string, href: string) {
  return href === "/home"
    ? pathname === "/home"
    : pathname === href || pathname.startsWith(href + "/");
}

export default function SiteHeader({ name, email, avatarUrl }: Props) {
  const pathname = usePathname();

  return (
    <>
      <aside className="site-sidebar" aria-label="Main navigation">
        <div className="site-sidebar-brand"><BrandMark /></div>
        <p className="site-sidebar-label">YOUR VAANI</p>
        <nav className="site-sidebar-links">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`site-sidebar-link ${active ? "site-sidebar-link-active" : ""}`}
                title={link.label}
              >
                <span className="site-nav-symbol" aria-hidden="true">{link.symbol}</span>
                <span className="site-sidebar-link-label">{link.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="site-sidebar-account">
          <Link href="/account" className="site-account-link" aria-label="Manage account">
            <ProfileAvatar name={name} avatarUrl={avatarUrl} size="sm" />
            <span className="site-account-copy">
              <strong>{name}</strong>
              <small>{email}</small>
            </span>
          </Link>
        </div>
      </aside>

      <header className="site-header site-mobile-header">
        <nav className="site-nav" aria-label="Main navigation">
          <BrandMark />
          <Link href="/account" aria-label="Manage account" className="site-mobile-account">
            <ProfileAvatar name={name} avatarUrl={avatarUrl} size="sm" />
          </Link>
        </nav>
      </header>

      <nav className="site-bottom-nav" aria-label="Main navigation">
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`site-bottom-link ${active ? "site-bottom-link-active" : ""}`}
            >
              <span className="site-nav-symbol" aria-hidden="true">{link.symbol}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
        <Link href="/account" className={`site-bottom-link ${pathname.startsWith("/account") ? "site-bottom-link-active" : ""}`}>
          <span className="site-nav-symbol" aria-hidden="true">○</span>
          <span>Profile</span>
        </Link>
      </nav>
    </>
  );
}
