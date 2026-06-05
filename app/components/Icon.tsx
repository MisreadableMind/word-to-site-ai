import type { ReactNode } from "react";

export type IconName =
  | "home"
  | "plus"
  | "edit"
  | "chart"
  | "card"
  | "cog"
  | "help"
  | "book"
  | "search"
  | "globe"
  | "mic"
  | "download"
  | "check";

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M2.5 7L8 2.5 13.5 7v6a1 1 0 01-1 1H3.5a1 1 0 01-1-1V7z" />
      <path d="M6.5 14V9.5h3V14" />
    </>
  ),
  plus: <path d="M8 3v10M3 8h10" />,
  edit: (
    <>
      <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5z" />
      <path d="M9.5 4l2.5 2.5" />
    </>
  ),
  chart: (
    <>
      <path d="M2.5 13.5h11" />
      <path d="M4 11V8M7 11V5M10 11V7M13 11V4" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="4" width="12" height="9" rx="1.2" />
      <path d="M2 7h12" />
    </>
  ),
  cog: (
    <>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </>
  ),
  help: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path
        d="M6.5 6.5a1.5 1.5 0 113 0c0 .8-.7 1.2-1.5 1.5v1M8 11h.01"
        strokeLinecap="round"
      />
    </>
  ),
  book: (
    <>
      <path d="M3 3h10v10H3z" />
      <path d="M3 3v10M8 3v10" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.3 10.3L14 14" strokeLinecap="round" />
    </>
  ),
  globe: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" />
    </>
  ),
  mic: (
    <>
      <rect x="6" y="2" width="4" height="8" rx="2" />
      <path d="M3.5 8a4.5 4.5 0 009 0M8 12.5v2M5.5 14.5h5" />
    </>
  ),
  download: <path d="M8 2v8M4.5 7L8 10.5 11.5 7M2.5 13.5h11" />,
  check: (
    <path
      d="M3 8l3.5 3.5L13 5"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

const STROKE_WIDTH: Partial<Record<IconName, number>> = {
  plus: 1.5,
  mic: 1.5,
  check: 1.6,
};

export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE_WIDTH[name] ?? 1.4}
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
