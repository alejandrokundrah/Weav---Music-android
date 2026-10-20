import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A titled block on the Home page.
 *
 * One heading style for every shelf — Lexend Light at a size that sits between the hero's
 * display title and the 14px row text — so the page reads as a single system rather than a
 * stack of unrelated `h2`s. The optional `action` sits on the heading's baseline, right-aligned.
 */
export function HomeSection({
  title,
  action,
  children,
  className,
  dimmed = false,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Fades the block while its content is still loading. */
  dimmed?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 transition-opacity",
        dimmed && "opacity-60",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="font-lexend text-xl font-light tracking-wide text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
