import { memo, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { SkinRecommendation } from "../types";

const PLACEHOLDER = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </svg>
);

const SkinThumb = memo(function SkinThumb({ skin }: { skin: SkinRecommendation }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const screenshotUrl = skin.demo_url
    ? `https://api.microlink.io/?url=${encodeURIComponent(skin.demo_url)}&screenshot=true&meta=false&embed=screenshot.url`
    : "";

  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  if (!screenshotUrl || failed) {
    return <div className="skin-thumb">{PLACEHOLDER}</div>;
  }
  return (
    <div className="skin-thumb">
      {!loaded ? <div className="skin-thumb-skeleton" aria-hidden="true" /> : null}
      <img
        ref={imgRef}
        src={screenshotUrl}
        alt={skin.title}
        loading="lazy"
        decoding="async"
        width={320}
        height={200}
        className={clsx(loaded && "is-loaded")}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
});

export const SkinCard = memo(function SkinCard({
  skin,
  selected,
  onSelect,
}: {
  skin: SkinRecommendation;
  selected: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className={clsx("skin-card", selected && "selected")} onClick={() => onSelect(skin.slug)}>
      <SkinThumb skin={skin} />
      <div className="skin-info">
        <h4>{skin.title}</h4>
        <p>{skin.reason || skin.category}</p>
        <div className="skin-meta">
          {skin.confidence ? <span className="skin-match">{Math.round(skin.confidence * 100)}% match</span> : null}
          {skin.demo_url ? (
            <a
              className="skin-preview"
              href={skin.demo_url}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.stopPropagation()}
            >
              Preview ↗
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
});
