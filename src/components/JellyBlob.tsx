export function JellyBlob() {
  return (
    <div className="relative w-full aspect-square max-w-[560px] mx-auto">
      {/* Orbit ring */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 560 560" fill="none">
        <ellipse
          cx="280"
          cy="280"
          rx="260"
          ry="240"
          stroke="oklch(0.85 0.04 285)"
          strokeWidth="1"
          strokeDasharray="3 6"
          opacity="0.6"
        />
        <ellipse
          cx="280"
          cy="290"
          rx="240"
          ry="220"
          stroke="oklch(0.88 0.03 285)"
          strokeWidth="1"
          opacity="0.5"
        />
      </svg>

      {/* Soft pink glow behind */}
      <div className="absolute left-[8%] top-[55%] w-40 h-40 rounded-full blur-3xl opacity-50"
           style={{ background: "radial-gradient(circle, oklch(0.85 0.15 20) 0%, transparent 70%)" }} />
      <div className="absolute right-[12%] top-[18%] w-32 h-32 rounded-full blur-3xl opacity-40"
           style={{ background: "radial-gradient(circle, oklch(0.85 0.15 350) 0%, transparent 70%)" }} />

      {/* Outer translucent bubble */}
      <div
        className="absolute inset-[8%] animate-jelly-outer"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, oklch(1 0 0 / 0.7), oklch(0.95 0.02 280 / 0.3) 50%, oklch(0.9 0.05 285 / 0.15) 100%)",
          boxShadow:
            "inset 0 0 60px oklch(1 0 0 / 0.6), inset 0 -20px 40px oklch(0.85 0.08 290 / 0.3), 0 20px 60px oklch(0.7 0.1 285 / 0.15)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Inner purple jelly */}
      <div
        className="absolute inset-[22%] animate-jelly"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, oklch(0.95 0.08 300 / 0.9), oklch(0.65 0.28 295) 40%, oklch(0.45 0.3 285) 80%)",
          boxShadow:
            "inset -20px -30px 60px oklch(0.3 0.25 285 / 0.6), inset 20px 20px 40px oklch(1 0 0 / 0.3), 0 30px 80px oklch(0.5 0.25 285 / 0.4)",
          filter: "blur(0.5px)",
        }}
      />

      {/* Highlight */}
      <div
        className="absolute left-[32%] top-[28%] w-[18%] h-[12%] rounded-full opacity-70 animate-jelly"
        style={{
          background: "radial-gradient(ellipse, oklch(1 0 0 / 0.9), transparent 70%)",
          filter: "blur(4px)",
        }}
      />

      {/* Labels with dots */}
      <Label text="STRATEGY" className="left-[28%] -top-2" dotColor="oklch(0.55 0.24 285)" />
      <Label text="CREATIVE" className="right-[2%] top-[8%]" dotColor="oklch(0.7 0.2 350)" />
      <Label text="AUTOMATION" className="left-[38%] -bottom-2" dotColor="oklch(0.7 0.2 40)" />
      <Label text="GROWTH" className="right-[2%] bottom-[12%]" dotColor="oklch(0.7 0.2 350)" />
    </div>
  );
}

function Label({ text, className, dotColor }: { text: string; className: string; dotColor: string }) {
  return (
    <div className={`absolute flex items-center gap-2 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: dotColor }} />
      <span className="text-[10px] tracking-[0.2em] text-muted-foreground font-medium">{text}</span>
    </div>
  );
}
