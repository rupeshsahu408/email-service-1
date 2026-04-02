import { SignupWizard } from "@/components/signup-wizard";

export const metadata = {
  title: "Create your email — Sendora",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SignupWizard />
    </div>
  );
}
