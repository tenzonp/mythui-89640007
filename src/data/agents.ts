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
    description: "Shapes products that customers love. Reyes runs discovery, prioritizes the roadmap, and turns raw ideas into shippable bets backed by real evidence.",
    skills: ["Product discovery", "Roadmap planning", "Prototyping", "User research"],
    image: novaImg,
    accent: "oklch(0.55 0.24 285)",
    accentSoft: "oklch(0.95 0.05 285)",
  },
  {
    id: "vale",
    name: "Vale",
    role: "Growth & Marketing",
    tagline: "The growth architect",
    description: "Drives demand across every channel. Vale designs campaigns, runs experiments, and compounds growth loops that move the metrics that matter.",
    skills: ["Performance marketing", "Content & SEO", "Lifecycle campaigns", "Growth experiments"],
    image: orionImg,
    accent: "oklch(0.55 0.18 250)",
    accentSoft: "oklch(0.94 0.04 250)",
  },
  {
    id: "bloom",
    name: "Bloom",
    role: "Sales & Revenue",
    tagline: "The revenue closer",
    description: "Turns interest into revenue. Bloom qualifies pipeline, personalizes outreach, and follows up with the discipline of a top closer.",
    skills: ["Lead scoring", "Outbound sequences", "Pipeline ops", "Deal follow-ups"],
    image: irisImg,
    accent: "oklch(0.7 0.2 350)",
    accentSoft: "oklch(0.95 0.05 350)",
  },
  {
    id: "kade",
    name: "Kade",
    role: "Operations & Systems",
    tagline: "The systems builder",
    description: "Automates the back office so the team can move fast. Kade wires integrations, builds workflows, and keeps every system humming.",
    skills: ["Workflow automation", "Integrations", "Reporting", "Process design"],
    image: atlasImg,
    accent: "oklch(0.7 0.2 40)",
    accentSoft: "oklch(0.95 0.05 60)",
  },
  {
    id: "lin",
    name: "Lin",
    role: "AI CEO & Strategist",
    tagline: "The chief of staff",
    description: "Sets direction and keeps the workforce aligned. Lin synthesizes signals across the team, makes the call, and turns strategy into weekly execution.",
    skills: ["Strategic planning", "OKRs & priorities", "Team orchestration", "Executive briefings"],
    image: echoImg,
    accent: "oklch(0.5 0.02 270)",
    accentSoft: "oklch(0.94 0.005 280)",
  },
  {
    id: "sage",
    name: "Sage",
    role: "Customer Support & Community",
    tagline: "The customer ally",
    description: "Cares for every customer and every community member. Sage answers tickets, nurtures community, and turns feedback into product fuel.",
    skills: ["Support replies", "Knowledge base", "Community management", "Voice-of-customer"],
    image: sageImg,
    accent: "oklch(0.65 0.13 195)",
    accentSoft: "oklch(0.95 0.04 195)",
  },
];

export const getAgent = (id: string) => agents.find((a) => a.id === id);
