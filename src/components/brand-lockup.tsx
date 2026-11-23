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
      <img
        src="/vaani-symbol.svg"
        width={dimension}
        height={dimension}
        className="brand-symbol"
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      {showWord && <span className="brand-word">vaani</span>}
    </Link>
  );
}

export function BrandMarkOnly({ size = "md" }: Pick<BrandMarkProps, "size">) {
  return <BrandMark size={size} showWord={false} />;
}
