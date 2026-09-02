import LoginForm from "@/components/login-form";

export const metadata = {
  title: "Check your email - Claude OpenAI",
  description: "A sign-in link and verification code were sent to your email.",
};

export default async function VerifyRequestPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    email?: string;
  }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Claude OpenAI
          </h1>
          <p className="text-muted text-sm leading-relaxed mt-2">
            One-time login verification
          </p>
        </div>

        <div className="panel rounded-xl p-8 shadow-2xl shadow-black/40 border border-border">
          <LoginForm
            callbackUrl={callbackUrl}
            initialCheckEmail={true}
            initialEmail={params.email ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
