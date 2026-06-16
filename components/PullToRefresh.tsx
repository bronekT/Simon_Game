"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Instagram-style pull-to-refresh. Pull down from the very top of the page and a
// spinner appears; release past the threshold and the screen reloads its data
// (router.refresh() re-runs the server components — fresh deals, approvals, etc.).
const THRESHOLD = 70;
const MAX = 96;

export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    const setP = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };

    function onStart(e: TouchEvent) {
      startY.current = !busy.current && window.scrollY <= 0 && e.touches[0] ? e.touches[0].clientY : null;
    }
    function onMove(e: TouchEvent) {
      if (startY.current == null || busy.current || !e.touches[0]) return;
      const dy = e.touches[0].clientY - startY.current;
      // Only react to a downward pull while already scrolled to the top.
      setP(dy > 0 && window.scrollY <= 0 ? Math.min(dy * 0.5, MAX) : 0);
    }
    function onEnd() {
      if (startY.current == null) return;
      startY.current = null;
      if (pullRef.current >= THRESHOLD && !busy.current) {
        busy.current = true;
        setRefreshing(true);
        setP(THRESHOLD);
        try {
          router.refresh();
        } catch {
          /* refresh is best-effort */
        }
        window.setTimeout(() => {
          busy.current = false;
          setRefreshing(false);
          setP(0);
        }, 1000);
      } else {
        setP(0);
      }
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  const settling = startY.current == null;
  const visible = pull > 0 || refreshing;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      style={{
        transform: `translateY(${Math.max(pull - 16, -28)}px)`,
        opacity: visible ? 1 : 0,
        transition: settling ? "transform .25s ease, opacity .25s ease" : undefined,
      }}
    >
      <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-bg shadow-lg">
        <span
          className={`text-xl text-accent ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        >
          ↻
        </span>
      </div>
    </div>
  );
}
