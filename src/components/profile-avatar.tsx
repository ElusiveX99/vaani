type Props = {
  name?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizes = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-base",
  xl: "h-24 w-24 text-2xl",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "V";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export default function ProfileAvatar({
  name,
  avatarUrl,
  size = "md",
  className = "",
}: Props) {
  const label = name?.trim() || "Vaani member";

  return (
    <span
      role="img"
      aria-label={label}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--line)] bg-[var(--rose-soft)] font-semibold tracking-wide text-[var(--plum)] ${sizes[size]} ${className}`}
    >
      <span aria-hidden="true">{initials(label)}</span>
      {avatarUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          onError={(event) => { event.currentTarget.style.display = "none"; }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}
