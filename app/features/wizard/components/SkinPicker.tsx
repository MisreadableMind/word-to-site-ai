import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { head, isEmpty, map } from "lodash-es";
import { useWizard } from "../WizardContext";
import { skinRecommendQuery } from "../queries";
import type { SkinRecommendation } from "../types";

const PLACEHOLDER_SVG = (
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
    return <div className="skin-thumb">{PLACEHOLDER_SVG}</div>;
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
        className={loaded ? "is-loaded" : ""}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
});

const SkinCard = memo(function SkinCard({
  skin,
  selected,
  onSelect,
}: {
  skin: SkinRecommendation;
  selected: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className={`skin-card${selected ? " selected" : ""}`} onClick={() => onSelect(skin.slug)}>
      <SkinThumb skin={skin} />
      <div className="skin-info">
        <h4>{skin.title}</h4>
        <p>{skin.reason || skin.category}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          {skin.confidence ? (
            <span className="skin-match">{Math.round(skin.confidence * 100)}% match</span>
          ) : null}
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

export function SkinPicker() {
  const { state, dispatch } = useWizard();
  const selectedSkin = state.selectedSkin;
  const { data: skins, isPending, isError } = useQuery(skinRecommendQuery(state.interviewAnswers));

  useEffect(() => {
    const first = head(skins);
    if (first && !selectedSkin) {
      dispatch({ type: "SELECT_SKIN", slug: first.slug });
    }
  }, [skins, selectedSkin, dispatch]);

  const onSelect = useCallback((slug: string) => dispatch({ type: "SELECT_SKIN", slug }), [dispatch]);

  if (isPending) {
    return (
      <div className="skin-loading">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" opacity="0.3" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        <div>Finding the best skins for your business…</div>
      </div>
    );
  }

  if (isError || isEmpty(skins)) {
    return <div className="skin-loading">Could not load skins. A default skin will be used.</div>;
  }

  return (
    <div className="skin-grid">
      {map(skins, (skin) => (
        <SkinCard
          key={skin.slug}
          skin={skin}
          selected={selectedSkin === skin.slug}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
