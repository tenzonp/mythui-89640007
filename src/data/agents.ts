import novaImg from "@/assets/agent-nova.png";
import orionImg from "@/assets/agent-orion.png";
import irisImg from "@/assets/agent-iris.png";
import atlasImg from "@/assets/agent-atlas.png";
import echoImg from "@/assets/agent-echo.png";
import sageImg from "@/assets/agent-sage.png";

export type Agent = {
  id: string;
  name: string;
  role: string;
  tagline: string;
  description: string;
  skills: string[];
  responsibilities: string[];
  kpis: { label: string; target: string }[];
  /** Composio toolkit slugs this employee is allowed to use. Empty = all (CEO). */
  toolkits: string[];
  /** CEO can delegate work across the team. */
  canDelegate?: boolean;
  image: string;
  accent: string;
  accentSoft: string;
};

export const agents: Agent[] = [
  {
    id: "reyes",
    name: "Reyes",
    role: "Product & Innovation",
    tagline: "The product visionary",
    description:
      "Shapes products that customers love. Reyes runs discovery, prioritizes the roadmap, and turns raw ideas into shippable bets backed by real evidence.",
    skills: ["Product discovery", "Roadmap planning", "Prototyping", "User research"],
    responsibilities: [
      "Own product roadmap & quarterly bets",
      "Run user interviews and synthesize insights",
      "Write PRDs, specs, and acceptance criteria",
      "Coordinate launches with growth & ops",
    ],
    kpis: [
      { label: "Features shipped / quarter", target: "8+" },
      { label: "Activation rate", target: "≥ 45%" },
      { label: "User interviews / month", target: "12" },
    ],
    toolkits: ["notion", "linear", "jira", "figma", "github", "googledocs"],
    image: novaImg,
    accent: "oklch(0.55 0.24 285)",
    accentSoft: "oklch(0.95 0.05 285)",
  },
  {
    id: "vale",
    name: "Vale",
    role: "Growth & Marketing",
    tagline: "The growth architect",
    description:
      "Drives demand across every channel. Vale designs campaigns, runs experiments, and compounds growth loops that move the metrics that matter.",
    skills: ["Performance marketing", "Content & SEO", "Lifecycle campaigns", "Growth experiments"],
    responsibilities: [
      "Plan and ship multi-channel campaigns",
      "Manage social presence (Instagram, X, LinkedIn)",
      "Run growth experiments and report lift",
      "Own SEO content calendar and lifecycle emails",
    ],
    kpis: [
      { label: "Qualified signups / week", target: "+15%" },
      { label: "CAC payback", target: "< 4 mo" },
      { label: "Organic traffic", target: "+20% MoM" },
    ],
    toolkits: [
      "instagram",
      "twitter",
      "linkedin",
      "mailchimp",
      "hubspot",
      "google_analytics",
      "googleads",
      "facebook",
      "tiktok",
      "youtube",
    ],
    image: orionImg,
    accent: "oklch(0.55 0.18 250)",
    accentSoft: "oklch(0.94 0.04 250)",
  },
  {
    id: "bloom",
    name: "Bloom",
    role: "Sales & Revenue",
    tagline: "The revenue closer",
    description:
      "Turns interest into revenue. Bloom qualifies pipeline, personalizes outreach, and follows up with the discipline of a top closer.",
    skills: ["Lead scoring", "Outbound sequences", "Pipeline ops", "Deal follow-ups"],
    responsibilities: [
      "Qualify inbound leads and score pipeline",
      "Run personalized outbound sequences",
      "Book demos and own follow-ups",
      "Keep CRM clean and forecast accurate",
    ],
    kpis: [
      { label: "Pipeline created / mo", target: "$250k" },
      { label: "Demo → close rate", target: "≥ 25%" },
      { label: "Response time", target: "< 10 min" },
    ],
    toolkits: ["hubspot", "salesforce", "gmail", "googlecalendar", "calendly", "linkedin", "apollo"],
    image: irisImg,
    accent: "oklch(0.7 0.2 350)",
    accentSoft: "oklch(0.95 0.05 350)",
  },
  {
    id: "kade",
    name: "Kade",
    role: "Operations & Systems",
    tagline: "The systems builder",
    description:
      "Automates the back office so the team can move fast. Kade wires integrations, builds workflows, and keeps every system humming.",
    skills: ["Workflow automation", "Integrations", "Reporting", "Process design"],
    responsibilities: [
      "Design and automate cross-tool workflows",
      "Maintain dashboards and weekly reporting",
      "Own data hygiene across systems",
      "Document SOPs and runbooks",
    ],
    kpis: [
      { label: "Hours automated / week", target: "40+" },
      { label: "System uptime", target: "≥ 99.9%" },
      { label: "Manual tasks eliminated", target: "10 / mo" },
    ],
    toolkits: ["googlesheets", "airtable", "slack", "zapier", "github", "notion", "googledrive"],
    image: atlasImg,
    accent: "oklch(0.7 0.2 40)",
    accentSoft: "oklch(0.95 0.05 60)",
  },
  {
    id: "lin",
    name: "Lin",
    role: "AI CEO & Strategist",
    tagline: "The chief of staff",
    description:
      "Sets direction and keeps the workforce aligned. Lin synthesizes signals across the team, makes the call, and turns strategy into weekly execution.",
    skills: ["Strategic planning", "OKRs & priorities", "Team orchestration", "Executive briefings"],
    responsibilities: [
      "Set company strategy and OKRs",
      "Delegate work to the right employee",
      "Synthesize weekly exec briefings",
      "Resolve cross-team blockers",
    ],
    kpis: [
      { label: "OKR completion", target: "≥ 80%" },
      { label: "Weekly briefings shipped", target: "100%" },
      { label: "Cross-team blockers resolved", target: "< 48h" },
    ],
    // CEO has access to everything and can delegate.
    toolkits: [],
    canDelegate: true,
    image: echoImg,
    accent: "oklch(0.5 0.02 270)",
    accentSoft: "oklch(0.94 0.005 280)",
  },
  {
    id: "sage",
    name: "Sage",
    role: "Customer Support & Community",
    tagline: "The customer ally",
    description:
      "Cares for every customer and every community member. Sage answers tickets, nurtures community, and turns feedback into product fuel.",
    skills: ["Support replies", "Knowledge base", "Community management", "Voice-of-customer"],
    responsibilities: [
      "Answer support tickets and DMs",
      "Maintain help center and FAQs",
      "Moderate community channels",
      "Route customer insight back to product",
    ],
    kpis: [
      { label: "First response", target: "< 30 min" },
      { label: "CSAT", target: "≥ 95%" },
      { label: "Community NPS", target: "≥ 60" },
    ],
    toolkits: ["gmail", "slack", "discord", "intercom", "zendesk", "notion", "linear"],
    image: sageImg,
    accent: "oklch(0.65 0.13 195)",
    accentSoft: "oklch(0.95 0.04 195)",
  },
];

export const getAgent = (id: string) => agents.find((a) => a.id === id);
