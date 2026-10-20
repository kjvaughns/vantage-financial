import { useEffect, useState } from "react";
import { Badge } from "@/components/portal/ui";
import { isNewContent, NEW_CONTENT_WINDOW_MS } from "@/lib/new-content";

export function NewContentBadge({ createdAt }: { createdAt?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!createdAt || !isNewContent(createdAt)) return;
    const remaining = Date.parse(createdAt) + NEW_CONTENT_WINDOW_MS - Date.now();
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [createdAt]);
  return isNewContent(createdAt, now) ? <Badge tone="blue">New</Badge> : null;
}