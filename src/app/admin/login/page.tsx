import { redirect } from "next/navigation";

export const metadata = {
  title: "Login — Sendora",
};

export default async function AdminLoginPage() {
  redirect("/login");
}
