import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={[
        "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
