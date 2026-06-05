import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { agents } from "@/data/agents";
import heroImg from "@/assets/landing-hero.jpg";
import panel2Img from "@/assets/landing-panel-2.jpg";
import panel3Img from "@/assets/landing-panel-3.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mythmind — A horizontal AI workforce" },
      { name: "description", content: "Scroll sideways. Meet the AI employees that think, build, and ship for you." },
      { property: "og:title", content: "Mythmind — A horizontal AI workforce" },
      { property: "og:description", content: "Scroll sideways. Meet the AI employees that think, build, and ship for you." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  component: Index,
});

// soft accent palette — bold black & white + young soft pops
const SOFT = {
  peach: "#FFD7C2",
  butter: "#FFE9A8",
  mint: "#CFEFE2",
  pink: "#FBD5E2",
  sky: "#D6E6FF",
};

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0..1
  const [panelCount] = useState(6);

  // Horizontal pan: container height = panelCount * 100vh, sticky track translates X
  useEffect(() => {
    const onScroll = () => {
      const el = wrapRef.current;
      const tr = trackRef.current;
      if (!el || !tr) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = el.offsetHeight - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const p = total > 0 ? scrolled / total : 0;
      setProgress(p);
      const trackWidth = tr.scrollWidth;
      const maxX = trackWidth - window.innerWidth;
      tr.style.transform = `translate3d(${-p * maxX}px, 0, 0)`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (loading || user) return null;

  return (
    <div className="bg-white text-black overflow-x-hidden">
      {/* Fixed minimal chrome */}
      <header className="fixed top-0 inset-x-0 z-50 mix-blend-difference">
        <div className="flex items-center justify-between px-6 md:px-10 py-6 text-white">
          <Link to="/" className="font-serif text-2xl tracking-tight">
            mythmind<span style={{ color: SOFT.peach }}>.</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-[10px] tracking-[0.28em] font-semibold">
            <span>SCROLL →</span>
            <span className="opacity-60">{String(Math.round(progress * 100)).padStart(2, "0")} / 100</span>
          </div>
          <Link to="/auth" className="text-[10px] tracking-[0.28em] font-semibold border border-white/60 rounded-full px-4 py-2 hover:bg-white hover:text-black transition-colors">
            ENTER
          </Link>
        </div>
      </header>

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-[2px] z-50 bg-transparent">
        <div className="h-full bg-black transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Horizontal scroll stage */}
      <div ref={wrapRef} style={{ height: `${panelCount * 100}vh` }} className="relative">
        <div className="sticky top-0 h-screen overflow-hidden">
          <div ref={trackRef} className="h-screen flex will-change-transform">

            {/* PANEL 1 — Hero */}
            <Panel bg="#FAFAFA">
              <div className="grid grid-cols-12 gap-8 w-full h-full items-center px-12">
                <div className="col-span-7 relative">
                  <div className="text-[10px] tracking-[0.32em] font-semibold mb-8" style={{ color: "#666" }}>
                    ISSUE №01 — A NEW KIND OF WORKFORCE
                  </div>
                  <h1 className="font-serif leading-[0.92] tracking-tight text-[clamp(64px,11vw,180px)]">
                    work, <span className="italic">sideways.</span>
                  </h1>
                  <p className="mt-10 max-w-md text-[15px] leading-relaxed text-neutral-600">
                    Mythmind is a horizontal magazine of AI employees — Nova, Orion, Iris, Atlas, Reyes — who think, plan and ship the boring parts of your business so you don't have to.
                  </p>
                  <div className="mt-12 flex items-center gap-6">
                    <Link to="/ai-employees" className="group inline-flex items-center gap-3 bg-black text-white pl-6 pr-2 py-2 rounded-full">
                      <span className="text-[11px] tracking-[0.22em] font-semibold">MEET THE STAFF</span>
                      <span className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center group-hover:rotate-45 transition-transform">
                        <ArrowUpRight className="w-4 h-4" />
                      </span>
                    </Link>
                    <div className="text-[10px] tracking-[0.28em] text-neutral-500">↳ DRAG / SCROLL TO READ</div>
                  </div>
                </div>
                <div className="col-span-5 relative h-[80vh]">
                  <div className="absolute inset-0 rounded-[2px] overflow-hidden">
                    <img src={heroImg} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-4 -left-6 px-4 py-2 bg-black text-white text-[10px] tracking-[0.28em]">
                    fig. 01 — origin
                  </div>
                  <div className="absolute top-4 right-4 w-20 h-20 rounded-full flex items-center justify-center text-[10px] tracking-[0.2em] font-semibold animate-spin-slow"
                    style={{ background: SOFT.butter }}>
                    LIVE · 24/7 ·
                  </div>
                </div>
              </div>
            </Panel>

            {/* PANEL 2 — Manifesto */}
            <Panel bg="#000" text="#fff">
              <div className="w-full h-full flex flex-col justify-center px-12 relative">
                <div className="text-[10px] tracking-[0.32em] font-semibold mb-8 opacity-60">
                  CHAPTER ONE — MANIFESTO
                </div>
                <h2 className="font-serif text-[clamp(48px,8vw,140px)] leading-[0.95] max-w-[18ch]">
                  not a tool. not a chatbot. <span className="italic" style={{ color: SOFT.mint }}>a staff.</span>
                </h2>
                <div className="mt-12 grid grid-cols-3 gap-12 max-w-4xl">
                  {[
                    ["01", "They specialize.", "Each AI employee owns one craft — and gets sharper every week."],
                    ["02", "They collaborate.", "Briefs hand off between them like a real team. No copy-paste."],
                    ["03", "They ship.", "Sites, posts, replies, decks — delivered, not just drafted."],
                  ].map(([n, t, d]) => (
                    <div key={n}>
                      <div className="text-[10px] tracking-[0.32em] opacity-50">{n}</div>
                      <div className="font-serif text-2xl mt-2">{t}</div>
                      <div className="text-sm mt-2 text-white/60 leading-relaxed">{d}</div>
                    </div>
                  ))}
                </div>
                <div className="absolute bottom-12 right-12 text-[10px] tracking-[0.28em] opacity-50">PG. 02</div>
              </div>
            </Panel>

            {/* PANEL 3 — Staff gallery */}
            <Panel bg={SOFT.peach}>
              <div className="w-full h-full flex flex-col justify-center px-12">
                <div className="flex items-end justify-between mb-12">
                  <div>
                    <div className="text-[10px] tracking-[0.32em] font-semibold mb-4">THE STAFF — FIVE PORTRAITS</div>
                    <h2 className="font-serif text-[clamp(48px,7vw,110px)] leading-[0.95]">
                      meet the <span className="italic">five.</span>
                    </h2>
                  </div>
                  <div className="text-[10px] tracking-[0.28em] text-black/60 max-w-xs text-right">
                    Each portrait below is a real working employee. Click one to give them a brief.
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-6">
                  {agents.map((a, i) => (
                    <Link
                      key={a.id}
                      to="/ai-employees/$agentId"
                      params={{ agentId: a.id }}
                      className="group"
                    >
                      <div className="aspect-[3/4] bg-white overflow-hidden mb-3 relative">
                        <img src={a.image} alt={a.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute top-2 left-2 text-[9px] tracking-[0.28em] font-semibold bg-black text-white px-2 py-1">
                          0{i + 1}
                        </div>
                      </div>
                      <div className="font-serif text-xl">{a.name.split(" ")[0]}</div>
                      <div className="text-[11px] tracking-[0.2em] text-black/60 uppercase">{a.role}</div>
                    </Link>
                  ))}
                </div>
              </div>
            </Panel>

            {/* PANEL 4 — Big editorial image */}
            <Panel bg="#fff">
              <div className="w-full h-full grid grid-cols-12 px-12 items-center gap-8">
                <div className="col-span-5 relative h-[80vh]">
                  <img src={panel2Img} alt="" className="w-full h-full object-cover" />
                  <div className="absolute -right-6 top-12 -rotate-90 origin-top-right text-[10px] tracking-[0.32em]">
                    HOW IT WORKS — A FILM IN THREE ACTS
                  </div>
                </div>
                <div className="col-span-7">
                  <div className="text-[10px] tracking-[0.32em] font-semibold mb-6 text-neutral-500">SPREAD 04</div>
                  <h2 className="font-serif text-[clamp(56px,8vw,130px)] leading-[0.95]">
                    you brief. <br />they <span className="italic" style={{ background: SOFT.mint, padding: "0 .2em" }}>build.</span>
                  </h2>
                  <div className="mt-10 space-y-6 max-w-lg text-[15px] leading-relaxed">
                    <Row n="1." title="Say it like a human.">No prompts to engineer. "Make me a landing page for my tea shop."</Row>
                    <Row n="2." title="Watch them think.">They open a thread, plan the work, ask for what they need.</Row>
                    <Row n="3." title="Ship live.">A real URL, a real post, a real reply — pushed live in minutes.</Row>
                  </div>
                </div>
              </div>
            </Panel>

            {/* PANEL 5 — Ticker / press */}
            <Panel bg={SOFT.mint}>
              <div className="w-full h-full flex flex-col justify-center px-12 relative">
                <div className="text-[10px] tracking-[0.32em] font-semibold mb-8">VOL. 01 — SHIPPED THIS WEEK</div>
                <div className="space-y-2">
                  {[
                    ["chiya-bajjar-premium.netlify.app", "Reyes — Product", "12s build"],
                    ["nova replied to 48 IG DMs", "Nova — Marketing", "auto"],
                    ["lead-scoring v2", "Atlas — Sales", "shipped"],
                    ["weekly brief: Q2 plan", "Orion — Research", "draft → final"],
                    ["new identity for nova-studio", "Iris — Design", "live"],
                  ].map(([t, who, status]) => (
                    <div key={t} className="grid grid-cols-12 items-center border-b border-black/15 py-4">
                      <div className="col-span-7 font-serif text-[clamp(20px,2.4vw,36px)] truncate">{t}</div>
                      <div className="col-span-3 text-[11px] tracking-[0.22em]">{who}</div>
                      <div className="col-span-2 text-right text-[11px] tracking-[0.22em] font-semibold">{status}</div>
                    </div>
                  ))}
                </div>
                <div className="absolute bottom-12 right-12 text-[10px] tracking-[0.28em] opacity-60">PG. 05</div>
              </div>
            </Panel>

            {/* PANEL 6 — Closing CTA */}
            <Panel bg="#000" text="#fff">
              <div className="w-full h-full grid grid-cols-12 items-center px-12 gap-8 relative">
                <div className="col-span-7">
                  <div className="text-[10px] tracking-[0.32em] font-semibold mb-8 opacity-60">END — TURN THE PAGE</div>
                  <h2 className="font-serif text-[clamp(64px,10vw,180px)] leading-[0.9]">
                    hire your <br/><span className="italic" style={{ color: SOFT.pink }}>first five.</span>
                  </h2>
                  <div className="mt-10 flex items-center gap-4">
                    <Link to="/auth" className="group inline-flex items-center gap-3 bg-white text-black pl-6 pr-2 py-2 rounded-full">
                      <span className="text-[11px] tracking-[0.22em] font-semibold">START FREE</span>
                      <span className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center group-hover:translate-x-1 transition-transform">
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </Link>
                    <Link to="/pricing" className="text-[11px] tracking-[0.22em] font-semibold border border-white/40 rounded-full px-5 py-2.5 hover:bg-white/10">
                      PLANS
                    </Link>
                  </div>
                </div>
                <div className="col-span-5 relative h-[80vh]">
                  <img src={panel3Img} alt="" className="w-full h-full object-cover grayscale" />
                  <div className="absolute bottom-4 left-4 px-3 py-1.5 text-[10px] tracking-[0.28em]" style={{ background: SOFT.pink, color: "#000" }}>
                    fin.
                  </div>
                </div>
                <div className="absolute bottom-6 left-12 text-[10px] tracking-[0.32em] opacity-50">
                  © 2026 Iscilla Technologies · Mythmind — <Link to="/terms" className="underline">terms</Link> · <Link to="/privacy" className="underline">privacy</Link>
                </div>
              </div>
            </Panel>

          </div>
        </div>
      </div>

      {/* Local styles */}
      <style>{`
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 12s linear infinite; }
      `}</style>
    </div>
  );
}

function Panel({ children, bg, text }: { children: React.ReactNode; bg: string; text?: string }) {
  return (
    <section
      className="h-screen flex-shrink-0 relative"
      style={{ width: "100vw", background: bg, color: text ?? "#000" }}
    >
      {children}
    </section>
  );
}

function Row({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="font-serif text-2xl w-8 shrink-0">{n}</div>
      <div>
        <div className="font-serif text-2xl">{title}</div>
        <div className="text-neutral-600 mt-1">{children}</div>
      </div>
    </div>
  );
}
