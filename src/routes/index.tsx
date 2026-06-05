import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowUpRight, ArrowRight, Plus, Star } from "lucide-react";
import { agents } from "@/data/agents";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mythmind — AI Workforce OS" },
      { name: "description", content: "A bold AI workforce that thinks, plans, and executes. Mythmind delivers the team behind your next move." },
      { property: "og:title", content: "Mythmind — AI Workforce OS" },
      { property: "og:description", content: "A team of AI employees that specialize, collaborate, and deliver real work." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700;800;900&display=swap" },
    ],
  }),
  component: Index,
});

const marqueeWords = ["STRATEGY", "DESIGN", "RESEARCH", "SALES", "OPS", "GROWTH", "CONTENT", "ANALYTICS"];
const stats = [
  { num: "12+", label: "AI EMPLOYEES" },
  { num: "24/7", label: "ALWAYS WORKING" },
  { num: "100x", label: "OUTPUT VELOCITY" },
  { num: "0", label: "MEETINGS NEEDED" },
];
const steps = [
  { n: "01", t: "HIRE", d: "Pick from a roster of specialized AI employees built for the work that actually moves your business." },
  { n: "02", t: "BRIEF", d: "Tell them what you need in plain language. They plan, ask questions, and confirm direction before executing." },
  { n: "03", t: "SHIP", d: "Real outputs. Real artifacts. Drafts, decks, code, campaigns — delivered while you sleep." },
];

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading]);
  if (loading || user) return null;

  return (
    <div className="min-h-screen bg-white text-black font-sans" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* HEADER */}
      <header className="border-b-2 border-black sticky top-0 z-50 bg-white">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black flex items-center justify-center">
              <div className="w-3 h-3 bg-white" />
            </div>
            <span className="text-xl font-black tracking-tighter" style={{ fontFamily: "'Archivo Black', sans-serif" }}>MYTHMIND</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-[11px] font-black tracking-[0.2em]">
            <Link to="/ai-employees" className="hover:underline underline-offset-4 decoration-2">EMPLOYEES</Link>
            <Link to="/solutions" className="hover:underline underline-offset-4 decoration-2">SOLUTIONS</Link>
            <Link to="/pricing" className="hover:underline underline-offset-4 decoration-2">PRICING</Link>
            <Link to="/about" className="hover:underline underline-offset-4 decoration-2">ABOUT</Link>
          </nav>
          <Link to="/auth" className="bg-black text-white px-5 py-2 text-[11px] font-black tracking-[0.2em] hover:bg-white hover:text-black border-2 border-black transition-colors">
            SIGN IN →
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="border-b-2 border-black">
        <div className="max-w-[1400px] mx-auto px-6 py-20 md:py-28">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
            <span className="text-[11px] font-black tracking-[0.3em]">AI WORKFORCE OS — V.2026</span>
          </div>
          <h1
            className="text-[14vw] md:text-[10vw] leading-[0.85] tracking-[-0.04em] font-black uppercase"
            style={{ fontFamily: "'Archivo Black', sans-serif" }}
          >
            HIRE THE<br />
            <span className="relative inline-block">
              <span className="relative z-10 text-white px-4">FUTURE.</span>
              <span className="absolute inset-0 bg-black -skew-x-6" />
            </span><br />
            FIRE THE<br />
            FRICTION.
          </h1>
          <div className="mt-12 grid md:grid-cols-2 gap-12 items-end">
            <p className="text-lg md:text-xl leading-snug max-w-md font-medium">
              A team of AI employees that think, plan, and execute. Not chatbots. Not toys. <span className="bg-black text-white px-2">Real work, shipped.</span>
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/ai-employees" className="group flex items-center gap-3 bg-black text-white px-6 py-4 border-2 border-black hover:bg-white hover:text-black transition-colors">
                <span className="text-sm font-black tracking-[0.2em]">LAUNCH WORKSPACE</span>
                <ArrowUpRight className="w-5 h-5 group-hover:rotate-45 transition-transform" />
              </Link>
              <Link to="/pricing" className="flex items-center gap-3 bg-white text-black px-6 py-4 border-2 border-black hover:bg-black hover:text-white transition-colors">
                <span className="text-sm font-black tracking-[0.2em]">SEE PRICING</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <section className="border-b-2 border-black bg-black text-white overflow-hidden">
        <div className="flex gap-12 py-5 animate-marquee whitespace-nowrap text-3xl font-black tracking-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
          {[...marqueeWords, ...marqueeWords, ...marqueeWords].map((w, i) => (
            <span key={i} className="flex items-center gap-12">
              {w}
              <Star className="w-6 h-6 fill-white" />
            </span>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="border-b-2 border-black">
        <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={`p-8 md:p-12 ${i < stats.length - 1 ? "md:border-r-2 border-black" : ""} ${i < 2 ? "border-b-2 md:border-b-0 border-black" : ""} ${i === 0 || i === 2 ? "border-r-2" : ""}`}>
              <div className="text-5xl md:text-6xl font-black tracking-tighter" style={{ fontFamily: "'Archivo Black', sans-serif" }}>{s.num}</div>
              <div className="mt-3 text-[11px] font-black tracking-[0.2em] text-black/60">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b-2 border-black">
        <div className="max-w-[1400px] mx-auto px-6 py-20 md:py-28">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-16">
            <div>
              <div className="text-[11px] font-black tracking-[0.3em] mb-4">— HOW IT WORKS</div>
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                THREE STEPS.<br />ZERO BS.
              </h2>
            </div>
            <Link to="/solutions" className="flex items-center gap-2 text-[11px] font-black tracking-[0.2em] underline underline-offset-4 decoration-2">
              SEE FULL FLOW <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 border-2 border-black">
            {steps.map((s, i) => (
              <div key={s.n} className={`p-8 md:p-10 bg-white ${i < 2 ? "border-b-2 md:border-b-0 md:border-r-2 border-black" : ""} hover:bg-black hover:text-white transition-colors group`}>
                <div className="flex items-start justify-between mb-12">
                  <span className="text-7xl font-black tracking-tighter" style={{ fontFamily: "'Archivo Black', sans-serif" }}>{s.n}</span>
                  <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                </div>
                <h3 className="text-2xl font-black tracking-tight mb-3" style={{ fontFamily: "'Archivo Black', sans-serif" }}>{s.t}</h3>
                <p className="text-sm leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AGENTS GRID */}
      <section className="border-b-2 border-black bg-black text-white">
        <div className="max-w-[1400px] mx-auto px-6 py-20 md:py-28">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-16">
            <div>
              <div className="text-[11px] font-black tracking-[0.3em] mb-4 text-white/60">— THE ROSTER</div>
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                MEET YOUR<br />NEW TEAM.
              </h2>
            </div>
            <Link to="/ai-employees" className="bg-white text-black px-6 py-4 border-2 border-white hover:bg-black hover:text-white transition-colors flex items-center gap-3">
              <span className="text-sm font-black tracking-[0.2em]">VIEW ALL</span>
              <ArrowUpRight className="w-5 h-5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 border-2 border-white">
            {agents.slice(0, 10).map((a, i) => (
              <Link
                key={a.id}
                to="/ai-employees/$agentId"
                params={{ agentId: a.id }}
                className={`group p-6 bg-black hover:bg-white hover:text-black transition-colors border-white ${(i + 1) % 5 !== 0 ? "lg:border-r-2" : ""} ${(i + 1) % 4 !== 0 ? "md:border-r-2" : ""} ${(i + 1) % 2 !== 0 ? "border-r-2" : ""} ${i < (agents.slice(0, 10).length - 2) ? "border-b-2" : ""}`}
              >
                <div className="aspect-square mb-4 overflow-hidden border-2 border-current bg-white">
                  <img src={a.image} alt={a.name} loading="lazy" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                </div>
                <div className="text-[10px] font-black tracking-[0.2em] opacity-60 mb-1">{`0${i + 1}`.slice(-2)}</div>
                <div className="text-lg font-black tracking-tight uppercase" style={{ fontFamily: "'Archivo Black', sans-serif" }}>{a.name.split(" ")[0]}</div>
                <div className="text-xs font-medium mt-1">{a.role}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* MANIFESTO */}
      <section className="border-b-2 border-black">
        <div className="max-w-[1400px] mx-auto px-6 py-20 md:py-32 grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-2 text-[11px] font-black tracking-[0.3em]">— MANIFESTO</div>
          <h2 className="md:col-span-10 text-4xl md:text-6xl font-black leading-[1] tracking-tight uppercase" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
            We don't believe in <span className="bg-black text-white px-3">assistants</span>. We believe in <span className="underline decoration-8 underline-offset-8">operators</span>. Software that owns outcomes, not tasks. A workforce that ships while the world sleeps.
          </h2>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-black text-white">
        <div className="max-w-[1400px] mx-auto px-6 py-24 md:py-32 text-center">
          <div className="text-[11px] font-black tracking-[0.3em] mb-6 text-white/60">— READY?</div>
          <h2 className="text-7xl md:text-[14vw] font-black leading-[0.85] tracking-[-0.04em] uppercase" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
            BUILD WITH<br />
            <span className="italic">A WORKFORCE.</span>
          </h2>
          <div className="mt-12 flex justify-center flex-wrap gap-4">
            <Link to="/auth" className="bg-white text-black px-8 py-5 border-2 border-white hover:bg-black hover:text-white transition-colors flex items-center gap-3">
              <span className="text-sm font-black tracking-[0.2em]">START FREE</span>
              <ArrowUpRight className="w-5 h-5" />
            </Link>
            <Link to="/pricing" className="bg-black text-white px-8 py-5 border-2 border-white hover:bg-white hover:text-black transition-colors">
              <span className="text-sm font-black tracking-[0.2em]">SEE PLANS</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t-2 border-black">
        <div className="max-w-[1400px] mx-auto px-6 py-10 flex flex-wrap items-center justify-between gap-4">
          <div className="text-[11px] font-black tracking-[0.2em]">© 2026 MYTHMIND — ISCILLA TECHNOLOGIES</div>
          <div className="flex gap-6 text-[11px] font-black tracking-[0.2em]">
            <Link to="/terms" className="hover:underline underline-offset-4 decoration-2">TERMS</Link>
            <Link to="/privacy" className="hover:underline underline-offset-4 decoration-2">PRIVACY</Link>
            <Link to="/support" className="hover:underline underline-offset-4 decoration-2">SUPPORT</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
