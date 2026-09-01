export function PaddleIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse cx="28" cy="24" rx="18" ry="20" fill="currentColor" />
      <ellipse cx="28" cy="24" rx="10" ry="11" fill="#0b1524" opacity="0.35" />
      <rect
        x="36"
        y="38"
        width="7"
        height="20"
        rx="2.5"
        transform="rotate(28 36 38)"
        fill="#8a9aab"
      />
      <circle cx="48" cy="14" r="4.5" fill="#00afd4" />
    </svg>
  );
}

export function PongHeroArt() {
  return (
    <div className="pong-hero-art pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="pong-table">
        <div className="pong-table-surface">
          <div className="pong-net" />
          <div className="pong-center-line" />
        </div>
      </div>
      <div className="paddle paddle-left animate-paddle-left">
        <PaddleIcon className="h-16 w-16 text-[var(--slate)] sm:h-20 sm:w-20" />
      </div>
      <div className="paddle paddle-right animate-paddle-right">
        <PaddleIcon className="h-14 w-14 -scale-x-100 text-[var(--slate)] sm:h-18 sm:w-18" />
      </div>
      <span className="pong-ball animate-rally-ball" />
    </div>
  );
}
