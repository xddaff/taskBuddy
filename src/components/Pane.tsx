import type { ReactNode } from "react";
import { CollapseIcon } from "@/components/Icons";

type PaneProps = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function Pane({ title, children, actions, footer, className = "" }: PaneProps) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-pane bg-paper shadow-pane ${className}`}
    >
      <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
        <h2 className="text-[15px] font-medium tracking-tight text-ink">{title}</h2>
        <div className="flex items-center gap-1 text-muted">
          {actions}
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted"
          >
            <CollapseIcon />
          </span>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">{children}</div>
      {footer ? <div className="p-3 pt-0">{footer}</div> : null}
    </section>
  );
}
