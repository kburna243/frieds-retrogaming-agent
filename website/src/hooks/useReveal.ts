import { useEffect } from "react";

/**
 * Adds `.is-visible` to every `.reveal` element once it scrolls into view.
 * Uses a single IntersectionObserver for the whole page.
 */
export function useReveal(dep?: unknown) {
  useEffect(() => {
    // slight delay to allow DOM to render after view change
    const timer = setTimeout(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
      if (els.length === 0) return;

      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("is-visible");
              io.unobserve(e.target);
            }
          }
        },
        { threshold: 0.08, rootMargin: "0px 0px -20px 0px" },
      );

      els.forEach((el) => {
        // if already in viewport, make visible immediately
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add("is-visible");
        } else {
          io.observe(el);
        }
      });

      return () => io.disconnect();
    }, 50);

    return () => clearTimeout(timer);
  }, [dep]);
}
