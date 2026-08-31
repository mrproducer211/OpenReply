import type { Metadata } from "next";
import LegalShell from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service - Claude OpenAI",
  description:
    "Terms for using Claude OpenAI's community-managed Instagram comment-to-DM service.",
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      description="These terms explain how to use Claude OpenAI responsibly. The service is built for the people and managed by the people."
      updatedAt="August 31, 2026"
    >
      <section>
        <h2 className="text-xl font-bold text-white">Authorized Use</h2>
        <p className="mt-3">
          You may use Claude OpenAI with Instagram professional accounts you own
          or are authorized to manage. You are responsible for the campaigns,
          keywords, links, and messages you choose to send.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">Platform Compliance</h2>
        <p className="mt-3">
          You agree to follow Meta Platform Terms, Instagram policies, applicable
          messaging rules, privacy laws, advertising rules, and anti-spam laws.
          The community team may rate-limit, pause, or disable campaigns that
          create compliance, abuse, security, or deliverability risk.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">A Community-Managed Service</h2>
        <p className="mt-3">
          Claude OpenAI is built for the people and managed by the people. We
          work together to keep it useful, safe, and dependable for creators,
          businesses, and communities. We may improve or change features as the
          service evolves.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">Availability</h2>
        <p className="mt-3">
          Claude OpenAI relies on Instagram and other trusted service partners.
          We work to keep the service available, but uninterrupted availability
          cannot be guaranteed.
        </p>
      </section>
    </LegalShell>
  );
}
