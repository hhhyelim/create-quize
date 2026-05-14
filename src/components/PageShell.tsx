import type { ReactNode } from "react";

type PageShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  tone?: "teacher" | "student";
};

export function PageShell({
  eyebrow,
  title,
  description,
  actions,
  children,
  tone = "student",
}: PageShellProps) {
  const isTeacher = tone === "teacher";

  return (
    <main
      className={[
        "min-h-screen px-5 py-6 sm:px-8 lg:px-10",
        isTeacher ? "bg-slate-50 text-slate-950" : "bg-sky-50 text-slate-950",
      ].join(" ")}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-2xl bg-white px-5 py-6 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div className="max-w-3xl">
            {eyebrow ? (
              <p
                className={[
                  "mb-2 text-sm font-bold uppercase tracking-wide",
                  isTeacher ? "text-teal-700" : "text-sky-700",
                ].join(" ")}
              >
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-3 text-lg leading-8 text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </header>

        {children}
      </div>
    </main>
  );
}
