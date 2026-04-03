import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Log in — Sendora",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.next;
  const nextParam = Array.isArray(raw) ? raw[0] : raw;

  return <LoginForm nextParam={nextParam} />;
}
