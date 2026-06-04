import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, PageHero } from "@/components/SiteChrome";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Mythmind by Iscilla Technologies" },
      { name: "description", content: "Terms governing the use of Mythmind by Iscilla Technologies." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHero kicker="LEGAL" title={<>Terms of <em className="font-serif italic text-violet">Service</em></>} subtitle="Last updated: June 4, 2026" />
      <article className="max-w-3xl mx-auto px-8 pb-24 prose prose-neutral dark:prose-invert">
        <p>
          These Terms of Service ("Terms") are a binding agreement between you and
          <strong> Iscilla Technologies</strong>, a company registered in Nepal ("we", "us", "our"),
          governing your use of Mythmind and any related services, websites, and software
          (collectively, the "Service"). By creating an account or using the Service you accept these Terms.
        </p>

        <h2>1. Accounts</h2>
        <p>You must be 13+ to use the Service. You are responsible for activity under your account and for keeping your credentials safe. We may suspend accounts that violate these Terms.</p>

        <h2>2. The Service</h2>
        <p>Mythmind provides AI agents, chat, automation tools, an AI website builder, and related infrastructure. Features evolve; we may add, change, or remove functionality at any time.</p>

        <h2>3. Plans, Credits & Billing</h2>
        <p>Paid plans are billed via Dodo Payments. Subscriptions renew automatically until cancelled. Credits granted under a plan are consumed by AI usage and expire at the end of each billing period unless stated otherwise. Fees are non-refundable except where required by law.</p>

        <h2>4. Acceptable Use</h2>
        <ul>
          <li>No illegal, harmful, hateful, deceptive, or infringing content.</li>
          <li>No attempts to reverse-engineer, overload, or abuse the Service or its rate limits.</li>
          <li>No use of the Service to build competing AI agent platforms.</li>
          <li>You are solely responsible for content you submit and for sites you generate and publish through the Service.</li>
        </ul>

        <h2>5. AI Output</h2>
        <p>AI outputs can be inaccurate or biased. You must review outputs before relying on them, especially for legal, medical, or financial decisions. We do not warrant outputs are correct or fit for any purpose.</p>

        <h2>6. Generated Websites</h2>
        <p>Websites generated and deployed via the Service are hosted on third-party infrastructure (currently Vercel). You are responsible for the content of your generated sites and for complying with the host's terms.</p>

        <h2>7. Intellectual Property</h2>
        <p>You retain ownership of content you submit. You grant us a worldwide license to host, process, and display that content solely to operate the Service. The Service itself, including software and trademarks, remains our property.</p>

        <h2>8. Termination</h2>
        <p>You may stop using the Service at any time. We may suspend or terminate accounts for breach of these Terms or for risk to the Service or other users.</p>

        <h2>9. Disclaimers & Liability</h2>
        <p>The Service is provided "as is" without warranties. To the maximum extent permitted by law, our aggregate liability shall not exceed the fees you paid to us in the 3 months preceding the claim.</p>

        <h2>10. Governing Law</h2>
        <p>These Terms are governed by the laws of Nepal. Disputes will be resolved in the competent courts of Kathmandu, Nepal.</p>

        <h2>11. Changes</h2>
        <p>We may update these Terms. Material changes will be announced in-app or by email. Continued use after changes means acceptance.</p>

        <h2>12. Contact</h2>
        <p>Iscilla Technologies, Nepal · <a href="mailto:iscillatechnologies@gmail.com">iscillatechnologies@gmail.com</a></p>
      </article>
      <SiteFooter />
    </div>
  );
}
