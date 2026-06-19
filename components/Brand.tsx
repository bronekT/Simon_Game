// Brand visuals for CLOSER — a premium door logomark and a friendly door mascot.
// Pure SVG (no images), gold-gradient, theme-matched.

export function BrandMark({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe6a8" />
          <stop offset="0.55" stopColor="#e9a23b" />
          <stop offset="1" stopColor="#c97f28" />
        </linearGradient>
        <radialGradient id="bm-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="34" r="24" fill="url(#bm-glow)" opacity="0.55" />
      <rect x="17" y="9" width="30" height="46" rx="8" fill="url(#bm-g)" />
      <rect x="17" y="9" width="30" height="46" rx="8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <rect x="22.5" y="14.5" width="19" height="35" rx="4" fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="1.6" />
      <circle cx="40" cy="33" r="2.6" fill="#241803" />
      <rect x="38.8" y="33" width="2.4" height="7" rx="1.2" fill="#241803" />
    </svg>
  );
}

// Friendly door character for empty/loading/celebration states.
export function Mascot({ size = 104, className = "", float = true }: { size?: number; className?: string; float?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={`${float ? "animate-float" : ""} ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id="ms-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe6a8" />
          <stop offset="0.5" stopColor="#e9a23b" />
          <stop offset="1" stopColor="#cf8a2c" />
        </linearGradient>
        <radialGradient id="ms-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="104" rx="30" ry="6" fill="#000" opacity="0.25" />
      <circle cx="60" cy="58" r="46" fill="url(#ms-glow)" opacity="0.5" />
      {/* arched door body */}
      <path d="M30 48a30 30 0 0 1 60 0v44a6 6 0 0 1-6 6H36a6 6 0 0 1-6-6V48Z" fill="url(#ms-g)" />
      <path d="M30 48a30 30 0 0 1 60 0v44a6 6 0 0 1-6 6H36a6 6 0 0 1-6-6V48Z" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
      {/* eyes */}
      <circle cx="49" cy="52" r="5.5" fill="#241803" />
      <circle cx="71" cy="52" r="5.5" fill="#241803" />
      <circle cx="50.6" cy="50.2" r="1.8" fill="#fff" />
      <circle cx="72.6" cy="50.2" r="1.8" fill="#fff" />
      {/* smile */}
      <path d="M50 64q10 9 20 0" stroke="#241803" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* cheeks */}
      <circle cx="42" cy="62" r="3.5" fill="#fff" opacity="0.25" />
      <circle cx="78" cy="62" r="3.5" fill="#fff" opacity="0.25" />
      {/* knob */}
      <circle cx="80" cy="80" r="3" fill="#241803" opacity="0.85" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`gradient-text font-semibold tracking-tight ${className}`}>CLOSER</span>
  );
}
