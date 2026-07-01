import { isSignupAllowed } from "@/lib/auth/signup";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const showSignupLink = await isSignupAllowed();
  return <LoginForm showSignupLink={showSignupLink} />;
}
