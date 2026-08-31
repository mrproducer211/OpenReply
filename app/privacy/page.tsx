import type { Metadata } from "next";
import LegalShell from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy - Claude OpenAI",
  description:
    "How Claude OpenAI's community-managed service handles account, Instagram, and campaign data.",
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      description="Claude OpenAI is a community-managed service that helps people build thoughtful Instagram comment-to-DM experiences. It is built for the people and managed by the people."
      updatedAt="August 31, 2026"
    >
      <section>
        <h2 className="text-xl font-bold text-white">Data We Collect</h2>
        <p className="mt-3">
          We collect the information needed to provide the service: your account
          email address, workspace details, connected Instagram account identifiers,
          encrypted access tokens, campaign settings, relevant webhook events,
          comments needed to process a campaign, delivery logs, and service
          diagnostics.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">How We Use Data</h2>
        <p className="mt-3">
          We use this information to sign you in, connect your Instagram account,
          run the campaigns you create, prevent duplicate sends, resolve problems,
          and keep the service safe and reliable. We do not sell personal data.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">Instagram Data</h2>
        <p className="mt-3">
          Claude OpenAI never asks for your Instagram password. Access tokens are
          encrypted at rest and used only for actions you authorize through your
          connected professional account. We do not scrape Instagram or automate
          browsers.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">Trusted Service Partners</h2>
        <p className="mt-3">
          The people who manage Claude OpenAI use trusted infrastructure, email,
          database, queue, and observability partners to operate the service.
          These partners process data only when needed to provide, secure, and
          improve the service.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">Retention And Deletion</h2>
        <p className="mt-3">
          You can disconnect Instagram in Settings at any time, which removes the
          stored connection and stops its campaigns. For account or data deletion,
          use the Data Deletion page linked in the footer.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">Contact</h2>
        <p className="mt-3">
          For privacy questions, contact the Claude OpenAI support team from the
          email address associated with your account.
        </p>
      </section>
    </LegalShell>
  );
}
