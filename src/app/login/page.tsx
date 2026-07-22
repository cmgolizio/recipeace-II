import { AuthForm } from "../../components/auth-form";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Log in or sign up
        </h1>
        <p className="text-sm opacity-70">
          Save your bar to your account. Ingredients
          you’ve already added will be stocked in your bar automatically! Yay!
        </p>
      </div>
      <AuthForm />
    </div>
  );
}