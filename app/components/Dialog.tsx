import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { filter, head, isEmpty, last } from "lodash-es";
import clsx from "clsx";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  className?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  children: ReactNode;
};

const FOCUSABLE =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

export function Dialog({ open, onClose, className, ariaLabel, ariaLabelledBy, children }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    const restore = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (node) {
      const initial =
        node.querySelector<HTMLElement>("[autofocus]") ?? node.querySelector<HTMLElement>(FOCUSABLE) ?? node;
      initial.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!node) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = filter(node.querySelectorAll<HTMLElement>(FOCUSABLE), (el) => el.offsetParent !== null);
      if (isEmpty(focusables)) {
        e.preventDefault();
        node.focus();
        return;
      }
      const firstEl = head(focusables);
      const lastEl = last(focusables);
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || active === node)) {
        e.preventDefault();
        lastEl?.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      restore?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="dialog-overlay open"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        className={clsx("dialog", className)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
