import { LoginForm } from "@/components/auth/login-form";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";

export default async function LoginPage() {
  // Locale resolution here is identical to every authenticated page's
  // (cookie-only, no auth dependency) — /login is reachable before any
  // session exists, so it must never depend on requireUser().
  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">
          {dictionary.auth.signInTitle}
        </h1>

        <LoginForm dictionary={dictionary.auth} />
      </div>
    </div>
  );
}
