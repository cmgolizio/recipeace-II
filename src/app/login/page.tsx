import { AuthForm } from "../../components/auth-form";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Log in or sign up
        </h1>
        <p className="text-sm text-muted">
          Save your bar to your account. Anything you’ve already added carries
          over automatically.
        </p>
      </div>
      <AuthForm />
    </div>
  );
}