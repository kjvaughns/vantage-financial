import { Link, useRouter, type LinkProps } from "@tanstack/react-router";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

/**
 * Back link that returns to the exact page the user came from (keeping filters,
 * folders and scroll), and falls back to `to` when opened directly from a URL.
 */
export function BackLink({ children, className, style, ...link }: LinkProps & { children: ReactNode; className?: string; style?: CSSProperties }) {
  const router = useRouter();
  const onClick = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const idx = (typeof window !== "undefined" ? (window.history.state as any)?.__TSR_index : 0) ?? 0;
    if (idx > 0) {
      e.preventDefault();
      router.history.back();
    }
  };
  return (
    <Link {...(link as any)} onClick={onClick} className={className} style={style}>
      {children}
    </Link>
  );
}
