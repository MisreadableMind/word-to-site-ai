import { useMemo, useState } from "react";
import { filter, isEmpty, map } from "lodash-es";
import { Dialog } from "~/components/Dialog";
import { Icon } from "~/components/Icon";
import { SkinCard } from "./SkinCard";
import type { SkinRecommendation } from "../types";

export function SkinBrowserDialog({
  open,
  onClose,
  skins,
  selectedSlug,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  skins: SkinRecommendation[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      q
        ? filter(skins, (s) => `${s.title} ${s.category} ${s.keywords}`.toLowerCase().includes(q))
        : skins,
    [skins, q],
  );

  return (
    <Dialog open={open} onClose={onClose} className="dialog-wide skin-browser-dialog" ariaLabel="Browse skins">
      <div className="skin-browser">
        <div className="skin-browser-head">
          <div className="skin-browser-search">
            <Icon name="search" />
            <input
              className="wts-input"
              placeholder="Search skins…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <button className="wts-btn ghost skin-browser-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="skin-browser-body">
          {!isEmpty(visible) ? (
            <div className="skin-grid">
              {map(visible, (skin) => (
                <SkinCard
                  key={skin.slug}
                  skin={skin}
                  selected={selectedSlug === skin.slug}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ) : (
            <div className="skin-loading">{search ? `No skins match “${search}”.` : "No skins available."}</div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
