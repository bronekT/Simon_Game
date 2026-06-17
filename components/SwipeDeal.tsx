"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DealCardBody } from "./DealCard";
import { setStatus } from "@/app/(app)/deals/[id]/quick-actions";
import type { Deal } from "@/lib/types";

// Swipe a deal: right → Won, left → Lost. A plain tap opens the deal.
export function SwipeDeal({ deal }: { deal: Deal }) {
  const router = useRouter();
  const startX = useRef(0);
  const startY = useRef(0);
  const moved = useRef(false); // did the finger travel (scroll/swipe) vs a clean tap?
  const [dx, setDx] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const wonRef = useRef<HTMLFormElement>(null);
  const lostRef = useRef<HTMLFormElement>(null);
  const THRESHOLD = 90;

  function onStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    moved.current = false;
    setSwiping(true);
  }
  function onMove(e: React.TouchEvent) {
    if (!swiping) return;
    const x = e.touches[0].clientX - startX.current;
    const y = e.touches[0].clientY - startY.current;
    // Any real travel (a vertical scroll OR a horizontal swipe) means this is
    // NOT a tap — so it must never open the deal.
    if (Math.abs(x) > 10 || Math.abs(y) > 10) moved.current = true;
    // Only follow the finger for a clearly-horizontal swipe (won/lost gesture).
    if (Math.abs(x) > Math.abs(y)) setDx(x);
  }
  function onEnd() {
    setSwiping(false);
    if (dx > THRESHOLD) {
      wonRef.current?.requestSubmit();
    } else if (dx < -THRESHOLD) {
      lostRef.current?.requestSubmit();
    } else if (!moved.current) {
      // A clean tap (no scroll, no swipe) → open the deal.
      router.push(`/deals/${deal.id}`);
    }
    setDx(0);
  }

  const hint =
    dx > 24 ? "won" : dx < -24 ? "lost" : null;

  return (
    <div className="relative overflow-hidden rounded-card">
      {/* Background hints */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-5 text-sm font-bold">
        <span className={hint === "won" ? "text-won" : "text-transparent"}>WON →</span>
        <span className={hint === "lost" ? "text-risk" : "text-transparent"}>← LOST</span>
      </div>

      <div
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        style={{ transform: `translateX(${dx}px)`, transition: swiping ? "none" : "transform 0.2s" }}
        className="active:scale-[0.995]"
      >
        <DealCardBody deal={deal} showFollowup />
      </div>

      {/* Hidden forms submitted on swipe */}
      <form ref={wonRef} action={setStatus} className="hidden">
        <input type="hidden" name="id" value={deal.id} />
        <input type="hidden" name="status" value="won" />
      </form>
      <form ref={lostRef} action={setStatus} className="hidden">
        <input type="hidden" name="id" value={deal.id} />
        <input type="hidden" name="status" value="lost" />
      </form>
    </div>
  );
}
