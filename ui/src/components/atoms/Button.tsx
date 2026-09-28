import type { ButtonHTMLAttributes } from "react";

const BASE =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS = {
  solid: "bg-ink text-chalk hover:bg-black",
  ghost: "bg-transparent text-ink border border-line hover:bg-chalk",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

/** For things that must look like a button but be a real link (`<a>`). */
export const buttonClasses = (variant: ButtonVariant = "solid", className = ""): string =>
  `${BASE} ${VARIANTS[variant]} ${className}`.trim();

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export default function Button({ variant = "solid", className = "", ...props }: ButtonProps) {
  return <button className={buttonClasses(variant, className)} {...props} />;
}
