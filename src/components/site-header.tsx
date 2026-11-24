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

type NavigationIconName = "home" | "calendar" | "profile";

function NavigationIcon({ name, className }: { name: NavigationIconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    focusable: false as const,
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="m3.5 10 8.5-7 8.5 7" />
        <path d="M5.5 9v11h13V9" />
        <path d="M9.5 20v-6h5v6" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
        <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
        <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

const links = [
  { href: "/home", label: "Home", icon: "home" as const },
  { href: "/sessions", label: "Gatherings", icon: "calendar" as const },
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
                <NavigationIcon name={link.icon} className="site-nav-icon" />
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
              <NavigationIcon name={link.icon} className="site-nav-icon" />
              <span>{link.label}</span>
            </Link>
          );
        })}
        <Link href="/account" className={`site-bottom-link ${pathname.startsWith("/account") ? "site-bottom-link-active" : ""}`}>
          <NavigationIcon name="profile" className="site-nav-icon" />
          <span>Profile</span>
        </Link>
      </nav>
    </>
  );
}