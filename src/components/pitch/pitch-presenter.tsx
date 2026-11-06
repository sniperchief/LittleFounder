"use client";

import { ArrowLeft, ArrowRight, Maximize, Minimize } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Slide } from "@/components/pitch/pitch-visuals";
import { Button } from "@/components/ui/button";
import { pitchSections } from "@/content/pitch-studio";
import type { PitchSnapshot } from "@/lib/data/pitch";

const slideNames = ["Title", ...pitchSections.map((s) => s.title)];

/** Present mode: one slide at a time, arrow keys or buttons, optional full screen. */
export function PitchPresenter({ deck }: { deck: PitchSnapshot }) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const last = slideNames.length - 1;

  const go = useCallback((delta: number) => setIndex((i) => Math.min(last, Math.max(0, i + delta))), [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      }
    };
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [go]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen?.().catch(() => {});
  }

  return (
    <div ref={stage} className={fullscreen ? "flex h-full flex-col justify-center bg-background p-4 sm:p-8" : ""}>
      <div aria-live="polite" aria-atomic="true" className={fullscreen ? "mx-auto w-full max-w-[min(100%,calc((100vh-8rem)*1.6))]" : ""}>
        <p className="sr-only">
          Slide {index + 1} of {slideNames.length}: {slideNames[index]}
        </p>
        <Slide deck={deck} index={index} present />
      </div>
      <div className="mx-auto mt-4 flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => go(-1)} disabled={index === 0}>
          <ArrowLeft aria-hidden="true" /> Previous
        </Button>
        <ol className="flex items-center gap-1.5" aria-label="Choose a slide">
          {slideNames.map((name, i) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Slide ${i + 1}: ${name}`}
                aria-current={i === index ? "true" : undefined}
                className={`size-3.5 rounded-full border-2 border-ink ${i === index ? "bg-ink" : "bg-surface"}`}
              />
            </li>
          ))}
        </ol>
        <Button onClick={() => go(1)} disabled={index === last}>
          Next <ArrowRight aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-3 text-center">
        <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />} {fullscreen ? "Exit full screen" : "Full screen"}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">Tip: use the arrow keys to move between slides.</p>
      </div>
    </div>
  );
}
