import type { ReactNode } from 'react';

// Hand-rolled, pixel-exact ports of the specific lucide-react icons
// postq-site's Header/Footer actually use (extracted from the live build's
// own bundled path data on 2026-07-17, not approximated) — the cabinet
// doesn't depend on the `lucide-react` package, so these are inlined here
// rather than reusing the Phosphor-based set in `@/components/icons`, which
// intentionally matches a different icon family for the rest of the app.
interface IconProps {
  className?: string;
}

function LucideIcon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <LucideIcon className={className}>
      <path d="m6 9 6 6 6-6" />
    </LucideIcon>
  );
}

export function LifeBuoyIcon({ className }: IconProps) {
  return (
    <LucideIcon className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.93 4.93 4.24 4.24" />
      <path d="m14.83 9.17 4.24-4.24" />
      <path d="m14.83 14.83 4.24 4.24" />
      <path d="m9.17 14.83-4.24 4.24" />
      <circle cx="12" cy="12" r="4" />
    </LucideIcon>
  );
}

export function ActivityIcon({ className }: IconProps) {
  return (
    <LucideIcon className={className}>
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </LucideIcon>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <LucideIcon className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </LucideIcon>
  );
}
