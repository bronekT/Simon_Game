"use client";

import { useEffect, useRef, useState } from "react";

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

// Animated count-up number — makes the figures feel alive and motivating.
export function Count({
  value,
  money = false,
  prefix = "",
  suffix = "",
  duration = 900,
  className = "",
}: {
  value: number;
  money?: boolean;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const ran = useRef(false);

  useEffect(() => {
    // Respect reduced-motion: jump straight to the value.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = ran.current ? n : 0;
    ran.current = true;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const rounded = Math.round(n);
  const text = money ? cad.format(rounded) : `${prefix}${rounded.toLocaleString("en-CA")}${suffix}`;
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {text}
    </span>
  );
}
