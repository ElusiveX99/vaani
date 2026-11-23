import Image from "next/image";
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
  const wordmark = inverse ? "/vaani-wordmark-inverse.svg" : "/vaani-wordmark.svg";
  const symbol = inverse ? "/vaani-symbol-inverse.svg" : "/vaani-symbol.svg";
  const wordWidth = size === "sm" ? 164 : 190;
  const wordHeight = size === "sm" ? 70 : 82;
  const symbolSize = size === "sm" ? 34 : 42;

  return (
    <Link href="/" className="brand-lockup" aria-label="Vaani home">
      {showWord ? (
        <>
          <Image className="brand-lockup__artwork brand-lockup__artwork--word" src={wordmark} alt="" width={wordWidth} height={wordHeight} priority unoptimized />
          <Image className="brand-lockup__artwork brand-lockup__artwork--symbol" src={symbol} alt="" width={symbolSize} height={symbolSize} priority unoptimized />
        </>
      ) : (
        <Image className="brand-lockup__artwork brand-lockup__artwork--symbol" src={symbol} alt="" width={symbolSize} height={symbolSize} priority unoptimized />
      )}
    </Link>
  );
}

export function BrandMarkOnly({ size = "md" }: Pick<BrandMarkProps, "size">) {
  return <BrandMark size={size} showWord={false} />;
}
