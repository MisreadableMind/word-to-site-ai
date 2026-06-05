import { useState } from "react";
import clsx from "clsx";

export interface FaqItem {
  q: string;
  a: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="faq-list fade-in">
      {items.map((item, i) => (
        <div key={i} className={clsx("faq-item", open === i && "open")}>
          <button
            className="faq-question"
            onClick={() => setOpen((cur) => (cur === i ? null : i))}
          >
            {item.q}
            <svg className="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <div className="faq-answer">
            <div className="faq-answer-inner">{item.a}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
