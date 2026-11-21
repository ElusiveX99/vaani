"use client";

import Link from "next/link";

type BrandMarkProps = {
  size?: "sm" | "md";
  showWord?: boolean;
};

export function BrandMark({ size = "md", showWord = true }: BrandMarkProps) {
  const dimension = size === "sm" ? 28 : 32;

  return (
    <Link
      href="/"
      className="brand-lockup"
      aria-label="Vaani home"
    >
      <svg
        width={dimension}
        height={dimension}
        viewBox="0 0 64 64"
        aria-hidden="true"
        focusable="false"
      >
        <g fill="#e8d6d1" stroke="#593b53" strokeWidth="2.2" strokeLinejoin="round">
          <path d="M32 29C22 23 19 14 25 10c5-3 10 3 7 19Z" />
          <path d="M35 29C42 19 50 17 53 23c2 5-3 10-17 10Z" />
          <path d="M35 33C45 30 53 34 52 40c-1 6-9 7-20-3Z" />
          <path d="M32 35C38 45 35 53 29 53c-6 0-8-8-2-20Z" />
          <path d="M29 33C19 39 11 37 11 31c0-6 8-8 20-4Z" />
          <path d="M30 30C23 20 15 19 12 24c-3 5 3 10 18 12Z" />
          <path d="M34 31C34 19 39 12 44 15c5 3 2 11-8 18Z" />
          <path d="M33 34C23 43 16 44 14 39c-2-5 4-10 17-10Z" />
        </g>
        <circle cx="32" cy="32" r="5.2" fill="#a98a5b" stroke="#593b53" strokeWidth="1.8" />
        <circle cx="32" cy="32" r="1.8" fill="#fffaf7" />
      </svg>
      {showWord && <span className="brand-word">Vaani</span>}
    </Link>
  );
}

export function BrandMarkOnly({ size = "md" }: Pick<BrandMarkProps, "size">) {
  return <BrandMark size={size} showWord={false} />;
}
