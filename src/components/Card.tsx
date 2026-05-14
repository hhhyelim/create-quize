import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={[
        "rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
