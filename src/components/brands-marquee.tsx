"use client";

import { useRef, useEffect, useCallback } from "react";

interface Brand {
  name: string;
  slug: string;
}

const ROW_ONE: Brand[] = [
  { name: "Apple", slug: "apple" },
  { name: "Amazon", slug: "amazon" },
  { name: "Meta", slug: "meta" },
  { name: "Netflix", slug: "netflix" },
  { name: "Adobe", slug: "adobe" },
  { name: "Microsoft", slug: "microsoft" },
  { name: "Google", slug: "google" },
  { name: "IBM", slug: "ibm" },
  { name: "Oracle", slug: "oracle" },
  { name: "PayPal", slug: "paypal" },
  { name: "Stripe", slug: "stripe" },
  { name: "Visa", slug: "visa" },
  { name: "Mastercard", slug: "mastercard" },
  { name: "Walmart", slug: "walmart" },
  { name: "Shopify", slug: "shopify" },
  { name: "eBay", slug: "ebay" },
  { name: "Alibaba", slug: "alibaba" },
  { name: "Dropbox", slug: "dropbox" },
  { name: "Salesforce", slug: "salesforce" },
  { name: "Flipkart", slug: "flipkart" },
];

const ROW_TWO: Brand[] = [
  { name: "Slack", slug: "slack" },
  { name: "Zoom", slug: "zoom" },
  { name: "LinkedIn", slug: "linkedin" },
  { name: "YouTube", slug: "youtube" },
  { name: "Spotify", slug: "spotify" },
  { name: "Snapchat", slug: "snapchat" },
  { name: "Pinterest", slug: "pinterest" },
  { name: "Samsung", slug: "samsung" },
  { name: "Sony", slug: "sony" },
  { name: "Nike", slug: "nike" },
  { name: "Adidas", slug: "adidas" },
  { name: "Puma", slug: "puma" },
  { name: "Figma", slug: "figma" },
  { name: "GitHub", slug: "github" },
  { name: "Airtel", slug: "airtel" },
  { name: "Vodafone", slug: "vodafone" },
  { name: "Zomato", slug: "zomato" },
  { name: "Starbucks", slug: "starbucks" },
  { name: "McDonald's", slug: "mcdonalds" },
  { name: "X", slug: "x" },
];

const SPEED = 0.45;

function MarqueeRow({
  brands,
  direction,
}: {
  brands: Brand[];
  direction: "left" | "right";
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartPos = useRef(0);
  const onethirdRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      onethirdRef.current = track.scrollWidth / 3;
    };
    measure();

    const dir = direction === "left" ? -1 : 1;

    const tick = () => {
      if (!isDragging.current) {
        posRef.current += dir * SPEED;
        const limit = onethirdRef.current;
        if (posRef.current <= -limit) posRef.current += limit;
        if (posRef.current >= 0 && direction === "right") posRef.current -= limit;
        track.style.transform = `translateX(${posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [direction]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartPos.current = posRef.current;
    trackRef.current?.setPointerCapture(e.pointerId);
    if (trackRef.current) trackRef.current.style.cursor = "grabbing";
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !trackRef.current) return;
    const delta = e.clientX - dragStartX.current;
    let next = dragStartPos.current + delta;
    const limit = onethirdRef.current;
    if (next <= -limit) next += limit;
    if (next > 0) next -= limit;
    posRef.current = next;
    trackRef.current.style.transform = `translateX(${next}px)`;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    if (trackRef.current) {
      trackRef.current.releasePointerCapture(e.pointerId);
      trackRef.current.style.cursor = "grab";
    }
  }, []);

  const tripled = [...brands, ...brands, ...brands];

  return (
    <div className="overflow-hidden w-full select-none">
      <div
        ref={trackRef}
        className="flex items-center gap-6 w-max will-change-transform"
        style={{ cursor: "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {tripled.map((brand, i) => (
          <div
            key={`${brand.slug}-${i}`}
            className="group flex-shrink-0 flex items-center justify-center w-28 h-14 rounded-2xl border border-[#ede9f8] bg-white shadow-sm hover:shadow-md hover:border-[#c4b5fd] transition-all duration-300"
          >
            <img
              src={`https://cdn.simpleicons.org/${brand.slug}`}
              alt={brand.name}
              draggable={false}
              className="pointer-events-none h-6 w-auto max-w-[72px] object-contain"
              style={{
                filter: "grayscale(100%) brightness(0) opacity(0.28)",
                transition: "filter 0.3s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLImageElement).style.filter =
                  "grayscale(0%) brightness(1) opacity(0.85)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLImageElement).style.filter =
                  "grayscale(100%) brightness(0) opacity(0.28)";
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BrandsMarquee() {
  return (
    <section className="relative overflow-hidden bg-white border-y border-[#ede9f8] py-14 sm:py-18">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-28 sm:w-40 z-10 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-28 sm:w-40 z-10 bg-gradient-to-l from-white to-transparent" />

      <div className="mx-auto max-w-7xl px-0 mb-10">
        <div className="text-center px-6">
          <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.25em] uppercase text-[#9896b4] mb-1">
            Brands That Trust Us
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1b33]">
            Loved by teams at the world&apos;s best companies
          </h2>
          <p className="mt-2 text-sm text-[#9896b4] max-w-md mx-auto">
            From startups to global enterprises — they all rely on Sendora for secure, private email.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <MarqueeRow brands={ROW_ONE} direction="left" />
        <MarqueeRow brands={ROW_TWO} direction="right" />
      </div>
    </section>
  );
}
