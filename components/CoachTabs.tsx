"use client";

import { useState } from "react";

// Top-level toggle for the Coach screen: "Общий разбор" vs "По встречам". Both
// slots are server-rendered and stay mounted (the hidden one via CSS), so the
// aggregate report keeps streaming and switching tabs is instant.
export function CoachTabs({ overview, meetings }: { overview: React.ReactNode; meetings: React.ReactNode }) {
  const [tab, setTab] = useState<"overview" | "meetings">("overview");
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-white/[0.06] p-1 text-sm">
        <button
          onClick={() => setTab("overview")}
          className={`rounded-full py-1.5 font-medium transition ${tab === "overview" ? "bg-accent/20 text-accent" : "text-muted"}`}
        >
          Общий разбор
        </button>
        <button
          onClick={() => setTab("meetings")}
          className={`rounded-full py-1.5 font-medium transition ${tab === "meetings" ? "bg-accent/20 text-accent" : "text-muted"}`}
        >
          По встречам
        </button>
      </div>
      <div className={tab === "overview" ? "flex flex-col gap-4" : "hidden"}>{overview}</div>
      <div className={tab === "meetings" ? "flex flex-col gap-2" : "hidden"}>{meetings}</div>
    </div>
  );
}
