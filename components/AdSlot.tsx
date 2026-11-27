"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSlotProps = {
  /** Ad unit slot id issued by Google AdSense (e.g. "1234567890"). */
  slot?: string;
  /** Human readable position, used for the development placeholder. */
  position?: "top" | "bottom";
};

export default function AdSlot({ slot, position = "top" }: AdSlotProps) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_ID;

  useEffect(() => {
    if (!client || !slot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* AdSense script blocked or not loaded yet — nothing to do. */
    }
  }, [client, slot]);

  if (!client || !slot) {
    // Never render an empty ad frame on the live site. Locally, show where
    // the slot will appear once the publisher id and slot ids are set.
    if (process.env.NODE_ENV === "production") return null;
    return (
      <div className="ad-slot ad-slot--placeholder" aria-hidden="true">
        광고 영역 ({position}) · NEXT_PUBLIC_ADSENSE_ID 와 슬롯 ID 를 넣으면
        표시됩니다
      </div>
    );
  }

  return (
    <aside className="ad-slot" aria-label="광고">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
