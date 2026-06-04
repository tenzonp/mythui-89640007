import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, PageHero } from "@/components/SiteChrome";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Mythmind by Iscilla Technologies" },
      { name: "description", content: "How Iscilla Technologies collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHero kicker="LEGAL" title={<>Privacy <em className="font-serif italic text-violet">Policy</em></>} subtitle="Last updated: June 4, 2026" />
      <article className="max-w-3xl mx-auto px-8 pb-24 prose prose-neutral dark:prose-invert">
        <p>This Privacy Policy describes how <strong>Iscilla Technologies</strong> (Nepal) handles personal data when you use Mythmind.</p>

        <h2>1. Data We Collect</h2>
        <ul>
          <li><strong>Account data:</strong> email, display name, avatar, authentication identifiers.</li>
          <li><strong>Usage data:</strong> chats, agents you create, files you upload, sites you generate, credit ledger entries.</li>
          <li><strong>Billing data:</strong> subscription tier, customer/subscription IDs from Dodo Payments. We do <em>not</em> store full card details — those stay with Dodo.</li>
          <li><strong>Technical data:</strong> IP, browser, device, basic logs needed to operate and secure the Service.</li>
          <li><strong>Connector data:</strong> when you connect third-party tools (e.g., Instagram, Gmail), we store the access tokens required to call those APIs on your behalf.</li>
        </ul>

        <h2>2. How We Use Data</h2>
        <ul>
          <li>Provide, secure, and improve the Service.</li>
          <li>Process payments and prevent abuse.</li>
          <li>Run AI features (your prompts/files are sent to AI providers — see below).</li>
          <li>Communicate about your account, billing, and important updates.</li>
        </ul>

        <h2>3. AI & Sub-processors</h2>
        <p>To deliver AI features and infrastructure we share strictly necessary data with:</p>
        <ul>
          <li>Lovable AI Gateway (Google Gemini, OpenAI) — model inference.</li>
          <li>Supabase — database, auth, storage.</li>
          <li>Dodo Payments — subscription billing.</li>
          <li>Vercel — hosting of websites you generate via the AI website builder.</li>
          <li>Composio, Firecrawl, E2B — agent tools you opt into.</li>
        </ul>
        <p>These providers process data under their own terms and our contracts with them.</p>

        <h2>4. Cookies</h2>
        <p>We use essential cookies and local storage for authentication and session state. We do not use third-party advertising cookies.</p>

        <h2>5. Data Retention</h2>
        <p>We retain account and usage data while your account is active and for up to 12 months after deletion for legal, fraud-prevention, and accounting reasons. You may request earlier deletion of specific content at any time.</p>

        <h2>6. Your Rights</h2>
        <p>You can access, correct, export, or delete your personal data by emailing us. Where applicable under local law (including Nepal data protection regulations) you also have the right to object to processing and to lodge a complaint with a competent authority.</p>

        <h2>7. Security</h2>
        <p>We use row-level security, encryption in transit (TLS), encrypted storage at our infrastructure providers, and least-privilege access controls. No system is 100% secure; report suspected issues to us immediately.</p>

        <h2>8. International Transfers</h2>
        <p>Our providers operate globally. By using the Service you consent to your data being processed in the regions where our providers operate, including the United States and the European Union.</p>

        <h2>9. Children</h2>
        <p>The Service is not directed to children under 13. We do not knowingly collect data from them.</p>

        <h2>10. Changes</h2>
        <p>We may update this Policy. Material changes will be announced in-app or by email.</p>

        <h2>11. Contact</h2>
        <p>Iscilla Technologies, Nepal · <a href="mailto:iscillatechnologies@gmail.com">iscillatechnologies@gmail.com</a></p>
      </article>
      <SiteFooter />
    </div>
  );
}
