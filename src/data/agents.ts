import novaImg from "@/assets/agent-nova.png";
import orionImg from "@/assets/agent-orion.png";
import irisImg from "@/assets/agent-iris.png";
import atlasImg from "@/assets/agent-atlas.png";
import echoImg from "@/assets/agent-echo.png";

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
    id: "nova",
    name: "Nova Reyes",
    role: "Marketing Agent",
    tagline: "The campaign architect",
    description: "Builds campaigns that attract and convert. Nova crafts narratives across channels with the precision of a strategist and the soul of a storyteller.",
    skills: ["Brand strategy", "Paid campaigns", "Content planning", "Email sequences"],
    image: novaImg,
    accent: "oklch(0.55 0.24 285)",
    accentSoft: "oklch(0.95 0.05 285)",
  },
  {
    id: "orion",
    name: "Orion Vale",
    role: "Research Agent",
    tagline: "The insight hunter",
    description: "Finds insights that drive decisions. Orion digs through markets, competitors and signals to surface what actually matters.",
    skills: ["Market analysis", "Competitor scans", "User interviews", "Trend reports"],
    image: orionImg,
    accent: "oklch(0.55 0.18 250)",
    accentSoft: "oklch(0.94 0.04 250)",
  },
  {
    id: "iris",
    name: "Iris Bloom",
    role: "Design Agent",
    tagline: "The visual maker",
    description: "Creates visuals that inspire action. Iris designs interfaces, brand systems and illustrations with a sharp aesthetic eye.",
    skills: ["UI design", "Brand systems", "Illustration", "Motion concepts"],
    image: irisImg,
    accent: "oklch(0.7 0.2 350)",
    accentSoft: "oklch(0.95 0.05 350)",
  },
  {
    id: "atlas",
    name: "Atlas Kade",
    role: "Sales Agent",
    tagline: "The deal closer",
    description: "Nurtures leads and closes more deals. Atlas qualifies, follows up and turns conversations into committed customers.",
    skills: ["Lead scoring", "Outreach", "Pipeline ops", "Follow-ups"],
    image: atlasImg,
    accent: "oklch(0.7 0.2 40)",
    accentSoft: "oklch(0.95 0.05 60)",
  },
  {
    id: "echo",
    name: "Echo Lin",
    role: "Operations Agent",
    tagline: "The quiet conductor",
    description: "Automates work and keeps everything smooth. Echo orchestrates workflows, integrations and the invisible glue that makes teams move.",
    skills: ["Workflow automation", "Integrations", "Reporting", "Quality checks"],
    image: echoImg,
    accent: "oklch(0.5 0.02 270)",
    accentSoft: "oklch(0.94 0.005 280)",
  },
];

export const getAgent = (id: string) => agents.find((a) => a.id === id);
