import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={[
        "min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg leading-8 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
