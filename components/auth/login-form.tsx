"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/auth/actions";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { resolveFieldError } from "@/lib/i18n/resolve-field-error";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

type LoginFormProps = {
  dictionary: Dictionary["auth"];
};

/**
 * Field-level error text: lib/validation/auth.ts's Zod schema sets
 * errors.email.message/errors.password.message to a stable code
 * ("invalidEmail"/"passwordRequired"), never English text directly —
 * resolveFieldError maps it through dictionary.auth.errors here, the one
 * presentation boundary for this form.
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
          <p className="text-[12.5px] text-red-600">
            {resolveFieldError(dictionary.errors, errors.email.message)}
          </p>
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
            {resolveFieldError(dictionary.errors, errors.password.message)}
          </p>
        )}
      </div>

      <Button type="submit" className="mt-2" disabled={isSubmitting}>
        {isSubmitting ? dictionary.signingIn : dictionary.signIn}
      </Button>
    </form>
  );
}
