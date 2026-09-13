import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">
          Sign in to Germes
        </h1>

        <LoginForm />
      </div>
    </div>
  );
}
