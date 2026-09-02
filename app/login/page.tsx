import LoginForm from "@/components/login-form";
import { getCampaignTemplate } from "@/lib/templates/campaign-templates";

export const metadata = {
  title: "Login - Claude OpenAI",
  description: "Sign in to manage Instagram comment-to-DM campaigns. Built for the people, by the people.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkEmail?: string;
    callbackUrl?: string;
    template?: string;
    error?: string;
    email?: string;
  }>;
}) {
  const params = await searchParams;
  const checkEmail = params.checkEmail === "1";
  const selectedTemplate = getCampaignTemplate(params.template);
  const templateCallbackUrl = selectedTemplate
    ? `/campaigns/new?template=${selectedTemplate.slug}`
    : null;
  const callbackUrl = params.callbackUrl ?? templateCallbackUrl ?? "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Claude OpenAI
          </h1>
          <p className="text-muted text-sm leading-relaxed mt-2">
            {selectedTemplate
              ? `Sign in to use the ${selectedTemplate.title} template.`
              : "Sign in with a one-time link or 6-digit code to connect your Instagram account."}
          </p>
        </div>

        <div className="panel rounded-xl p-8 shadow-2xl shadow-black/40 border border-border">
          {selectedTemplate && !checkEmail && (
            <div className="mb-5 rounded-lg border border-accent/20 bg-accent/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Template selected
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {selectedTemplate.title}
              </p>
            </div>
          )}

          <LoginForm
            callbackUrl={callbackUrl}
            initialError={params.error}
            initialCheckEmail={checkEmail}
            initialEmail={params.email ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
