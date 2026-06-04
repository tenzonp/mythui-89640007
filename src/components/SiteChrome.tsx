import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Grid3x3, LogOut, User, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const nav = [
  { to: "/ai-employees", label: "AI EMPLOYEES" },
  { to: "/solutions", label: "SOLUTIONS" },
  { to: "/about", label: "ABOUT" },
  { to: "/pricing", label: "PRICING" },
  { to: "/resources", label: "RESOURCES" },
] as const;

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const name = user?.email?.split("@")[0] ?? "User";
  const initial = name[0]?.toUpperCase() ?? "U";

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
        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border hover:bg-accent transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
                {initial}
              </div>
              <span className="text-xs font-medium hidden sm:inline">{name}</span>
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-xl border bg-card shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b">
                    <div className="text-sm font-medium truncate">{name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                    Dashboard
                  </Link>
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link to="/auth" className="hidden md:inline text-[11px] tracking-[0.18em] font-medium hover:text-violet transition-colors">
            SIGN IN
          </Link>
        )}
        <button className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "var(--ink)" }}>
          <Grid3x3 className="w-4 h-4 text-white" />
        </button>
      </div>
    </header>
  );
}




export function SiteFooter() {
  return (
    <footer className="max-w-[1240px] mx-auto px-8 py-12 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-4">
      <div>© 2026 Iscilla Technologies · Mythmind</div>
      <div className="flex items-center gap-4">
        <Link to="/knowledge" className="hover:text-violet">Knowledge</Link>
        <Link to="/support" className="hover:text-violet">Support</Link>
        <Link to="/terms" className="hover:text-violet">Terms</Link>
        <Link to="/privacy" className="hover:text-violet">Privacy</Link>
      </div>
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
