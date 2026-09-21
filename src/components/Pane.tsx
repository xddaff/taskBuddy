import type { ReactNode } from "react";

type PaneProps = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function Pane({ title, children, actions, className = "" }: PaneProps) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-pane bg-paper shadow-pane ${className}`}
    >
      <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
        <h2 className="text-[15px] font-medium tracking-tight text-ink">{title}</h2>
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-3">{children}</div>
    </section>
  );
}
