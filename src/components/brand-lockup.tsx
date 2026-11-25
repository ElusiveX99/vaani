import Link from "next/link";

type BrandMarkProps = {
  size?: "sm" | "md";
  showWord?: boolean;
  inverse?: boolean;
};

export function BrandMark({
  inverse = false,
}: BrandMarkProps) {
  return (
    <Link
      href="/"
      className={`brand-lockup${inverse ? " brand-lockup--inverse" : ""}`}
      aria-label="Vaani home"
    >
      <span className="brand-word">Vaani</span>
    </Link>
  );
}

export function BrandMarkOnly({ size = "md" }: Pick<BrandMarkProps, "size">) {
  return <BrandMark size={size} showWord={true} />;
}
