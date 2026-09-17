"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/auth/actions";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

type LoginFormProps = {
  dictionary: Dictionary["auth"];
};

/**
 * Field-level error text (errors.email.message/errors.password.message)
 * comes straight from lib/validation/auth.ts's Zod schema, which stays
 * English-only in this stage — see the final report's "remaining
 * intentionally-untranslated UI" note. Everything else (labels, button,
 * the server action's generic failure message) is localized.
 */
export function LoginForm({ dictionary }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginInput) {
    const result = await login(data);
    if (result?.error) {
      toast.error(result.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-6 flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{dictionary.email}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-[12.5px] text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{dictionary.password}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-[12.5px] text-red-600">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" className="mt-2" disabled={isSubmitting}>
        {isSubmitting ? dictionary.signingIn : dictionary.signIn}
      </Button>
    </form>
  );
}
