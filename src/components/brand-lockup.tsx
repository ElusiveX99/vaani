import Link from "next/link";

type BrandMarkProps = {
  size?: "sm" | "md";
  showWord?: boolean;
  inverse?: boolean;
};

export function BrandMark({
  size = "md",
  showWord = true,
  inverse = false,
}: BrandMarkProps) {
  const dimension = size === "sm" ? 30 : 36;

  return (
    <Link
      href="/"
      className={`brand-lockup${inverse ? " brand-lockup--inverse" : ""}`}
      aria-label="Vaani home"
    >
      <svg
        className="brand-symbol"
        width={dimension}
        height={dimension}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M7 9C14 9 18 18 24 37C30 18 34 9 41 9"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M31 20C34 22 36 26 36 30M35 14C41 18 44 24 44 31"
          stroke="#A77D82"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="42" cy="39" r="1.8" fill="#A98A5B" />
      </svg>
      {showWord && <span className="brand-word">vaani</span>}
    </Link>
  );
}

export function BrandMarkOnly({ size = "md" }: Pick<BrandMarkProps, "size">) {
  return <BrandMark size={size} showWord={false} />;
}
