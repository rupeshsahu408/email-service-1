import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Log in — Sendora",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <LoginForm />
    </div>
  );
}
