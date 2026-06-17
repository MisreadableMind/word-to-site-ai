import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { compact, find, head, isEmpty, map, size, take, uniqBy } from "lodash-es";
import { Icon } from "~/components/Icon";
import { useWizard } from "../WizardContext";
import { skinRecommendQuery } from "../queries";
import { SkinCard } from "./SkinCard";
import { SkinBrowserDialog } from "./SkinBrowserDialog";

const INLINE_SKIN_COUNT = 8;

export function SkinPicker() {
  const { state, dispatch } = useWizard();
  const selectedSkin = state.selectedSkin;
  const { data: skins, isPending, isError } = useQuery(skinRecommendQuery(state.interviewAnswers));
  const [browserOpen, setBrowserOpen] = useState(false);

  useEffect(() => {
    const first = head(skins);
    if (first && !selectedSkin) {
      dispatch({ type: "SELECT_SKIN", slug: first.slug });
    }
  }, [skins, selectedSkin, dispatch]);

  const onSelect = useCallback((slug: string) => dispatch({ type: "SELECT_SKIN", slug }), [dispatch]);

  const inline = useMemo(() => {
    const all = skins ?? [];
    const top = take(all, INLINE_SKIN_COUNT);
    const selected = find(all, (s) => s.slug === selectedSkin);
    return take(uniqBy(compact([selected, ...top]), "slug"), INLINE_SKIN_COUNT);
  }, [skins, selectedSkin]);

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

  const allSkins = skins ?? [];

  if (isError || isEmpty(allSkins)) {
    return <div className="skin-loading">Could not load skins. A default skin will be used.</div>;
  }

  return (
    <>
      <div className="skin-grid">
        {map(inline, (skin) => (
          <SkinCard
            key={skin.slug}
            skin={skin}
            selected={selectedSkin === skin.slug}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className="skin-browser-foot">
        <span>Browse the full library of {size(allSkins)} skins</span>
        <button className="wts-btn ghost" onClick={() => setBrowserOpen(true)}>
          <Icon name="search" /> See all skins
        </button>
      </div>
      <SkinBrowserDialog
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        skins={allSkins}
        selectedSlug={selectedSkin}
        onSelect={(slug) => {
          onSelect(slug);
          setBrowserOpen(false);
        }}
      />
    </>
  );
}
