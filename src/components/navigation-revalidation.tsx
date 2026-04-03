"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * After back/forward navigation the page may be restored from bfcache with
 * stale React Server Components. Refresh re-fetches using the current cookies.
 */
export function NavigationRevalidation() {
  const router = useRouter();
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [router]);
  return null;
}
