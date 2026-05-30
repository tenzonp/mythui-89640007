import { Link } from "@tanstack/react-router";
import { Grid3x3 } from "lucide-react";

const nav = [
  { to: "/ai-employees", label: "AI EMPLOYEES" },
  { to: "/solutions", label: "SOLUTIONS" },
  { to: "/about", label: "ABOUT" },
  { to: "/pricing", label: "PRICING" },
  { to: "/resources", label: "RESOURCES" },
] as const;

export function SiteHeader() {
  return (
    <header className="max-w-[1240px] mx-auto px-8 pt-8 flex items-center justify-between">
      <Link to="/" className="font-serif text-2xl tracking-tight">
        mythmind<span className="text-violet">.</span>
      </Link>
      <nav className="hidden md:flex items-center gap-10 text-[11px] tracking-[0.18em] font-medium text-foreground/80">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeProps={{ className: "text-violet" }}
            className="hover:text-violet transition-colors"
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <Link to="/auth" className="hidden md:inline text-[11px] tracking-[0.18em] font-medium hover:text-violet transition-colors">
          SIGN IN
        </Link>
        <button className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "var(--ink)" }}>
          <Grid3x3 className="w-4 h-4 text-white" />
        </button>
      </div>

export function SiteFooter() {
  return (
    <footer className="max-w-[1240px] mx-auto px-8 py-12 text-xs text-muted-foreground flex justify-between">
      <div>© 2026 Mythmind</div>
      <div>AI Workforce OS</div>
    </footer>
  );
}

export function PageHero({ kicker, title, subtitle }: { kicker: string; title: React.ReactNode; subtitle?: string }) {
  return (
    <section className="max-w-[1240px] mx-auto px-8 pt-20 pb-12">
      <div className="text-violet text-[11px] tracking-[0.22em] font-semibold mb-6">{kicker}</div>
      <h1 className="font-serif text-[64px] leading-[1.05] tracking-tight max-w-3xl">{title}</h1>
      {subtitle && <p className="mt-6 text-muted-foreground max-w-xl leading-relaxed">{subtitle}</p>}
    </section>
  );
}
