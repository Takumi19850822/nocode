import { isSignupAllowed } from "@/lib/auth/signup";
import { LoginForm } from "./LoginForm";

export const runtime = "edge";

export default async function LoginPage() {
  const showSignupLink = await isSignupAllowed();
  return <LoginForm showSignupLink={showSignupLink} />;
}
