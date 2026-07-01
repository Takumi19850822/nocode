import { redirect } from "next/navigation";
import { isSignupAllowed } from "@/lib/auth/signup";
import { SignupForm } from "./SignupForm";

export const runtime = "edge";

export default async function SignupPage() {
  const allowed = await isSignupAllowed();
  if (!allowed) redirect("/login?error=signup_disabled");

  return <SignupForm />;
}
