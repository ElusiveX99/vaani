import Image from "next/image";
import Link from "next/link";

type BrandMarkProps = {
  size?: "sm" | "md";
  showWord?: boolean;
  inverse?: boolean;
};

export function BrandMark({ size = "md", showWord = true, inverse = false }: BrandMarkProps) {
  const dimension = size === "sm" ? 30 : 38;
  return (
    <Link href="/" className={`brand-lockup${inverse ? " brand-lockup--inverse" : ""}`} aria-label="Vaani home">
      <Image
        src={inverse ? "/brand/vaani-emblem-light.svg" : "/brand/vaani-emblem.svg"}
        width={dimension}
        height={dimension}
        style={{ width: dimension, height: dimension, flexShrink: 0 }}
        alt=""
        aria-hidden="true"
        priority
        unoptimized
      />
      {showWord ? <span className="brand-word">Vaani</span> : null}
    </Link>
  );
}

export function BrandMarkOnly({ size = "md" }: Pick<BrandMarkProps, "size">) {
  return <BrandMark size={size} showWord={false} />;
}
