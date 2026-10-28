"use client";
import { useEffect } from "react";
// Scroll reveal, count-up stats and sticky-nav shadow for the company profile.
export default function Motion() {
  useEffect(() => {
    const root = document.documentElement;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.classList.add("cp-motion");
    const count = (el: HTMLElement) => {
      const end = Number(el.dataset.count);
      if (still) return void (el.textContent = String(end));
      const start = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - start) / 1400);
        el.textContent = String(Math.round(end * (1 - (1 - k) ** 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          e.target.querySelectorAll<HTMLElement>("[data-count]").forEach(count);
          io.unobserve(e.target);
        }),
      { threshold: 0.15 },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    const nav = document.querySelector(".cp-nav");
    const onScroll = () => nav?.classList.toggle("scrolled", scrollY > 12);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      removeEventListener("scroll", onScroll);
      root.classList.remove("cp-motion");
    };
  }, []);
  return null;
}
