export function AgentIcon({ variant }: { variant: "marketing" | "research" | "design" | "sales" | "operations" }) {
  const gradients = {
    marketing: ["oklch(0.7 0.2 285)", "oklch(0.55 0.25 285)"],
    research: ["oklch(0.75 0.12 250)", "oklch(0.55 0.18 250)"],
    design: ["oklch(0.8 0.15 350)", "oklch(0.65 0.22 350)"],
    sales: ["oklch(0.8 0.15 40)", "oklch(0.65 0.2 40)"],
    operations: ["oklch(0.7 0.02 270)", "oklch(0.45 0.02 270)"],
  } as const;
  const [c1, c2] = gradients[variant];
  const id = `g-${variant}`;
  return (
    <svg viewBox="0 0 80 80" className="w-16 h-16 drop-shadow-lg">
      <defs>
        <radialGradient id={id} cx="35%" cy="30%">
          <stop offset="0%" stopColor="oklch(1 0 0)" stopOpacity="0.9" />
          <stop offset="40%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </radialGradient>
      </defs>
      {variant === "marketing" && (
        <path d="M40 8 L52 32 L76 40 L52 48 L40 72 L28 48 L4 40 L28 32 Z" fill={`url(#${id})`} />
      )}
      {variant === "research" && (
        <circle cx="40" cy="40" r="28" fill="none" stroke={`url(#${id})`} strokeWidth="10" />
      )}
      {variant === "design" && (
        <path d="M40 10 L70 62 L10 62 Z" fill={`url(#${id})`} />
      )}
      {variant === "sales" && (
        <path d="M40 12 C58 12 70 24 70 40 C70 56 58 68 40 68 C30 68 22 62 18 54 C26 56 36 52 40 44 C44 36 40 26 32 22 C34 16 36 12 40 12 Z" fill={`url(#${id})`} />
      )}
      {variant === "operations" && (
        <path d="M40 8 L66 22 L66 50 L40 64 L14 50 L14 22 Z" fill={`url(#${id})`} />
      )}
    </svg>
  );
}
