import type { ButtonHTMLAttributes } from "react";

export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex min-h-[44px] items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
