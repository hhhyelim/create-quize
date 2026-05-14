import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet";
};

const variants = {
  primary: "bg-sky-600 text-white hover:bg-sky-700",
  secondary: "bg-teal-600 text-white hover:bg-teal-700",
  quiet: "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50",
};

export function Button({
  href,
  children,
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  const classes = [
    "inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-base font-bold transition focus:outline-none focus:ring-4 focus:ring-sky-200",
    variants[variant],
    className,
  ].join(" ");

  if (href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  );
}
