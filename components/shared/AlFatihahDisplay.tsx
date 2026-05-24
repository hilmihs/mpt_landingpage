"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AL_FATIHAH } from "@/lib/arabic";
import type { ErrorItem, IndikatorKey } from "@/types";
import { Languages, BookOpen } from "lucide-react";

interface Props {
  showHighlights?: boolean;
  errorsByCategory?: Record<IndikatorKey, ErrorItem[]>;
  defaultShowLatin?: boolean;
  defaultShowTerjemahan?: boolean;
}

const CATEGORY_COLOR: Record<IndikatorKey, string> = {
  harakat: "bg-amber-200/60 ring-amber-500",
  huruf: "bg-rose-200/60 ring-rose-500",
  panjang_pendek: "bg-sky-200/60 ring-sky-500",
  syaddah: "bg-violet-200/60 ring-violet-500",
};

function buildLookup(
  errorsByCategory: Record<IndikatorKey, ErrorItem[]>,
): Map<string, IndikatorKey[]> {
  const lookup = new Map<string, IndikatorKey[]>();
  (Object.keys(errorsByCategory) as IndikatorKey[]).forEach((cat) => {
    errorsByCategory[cat].forEach((e) => {
      const key = `${e.ayat}:${e.kata_idx}`;
      const arr = lookup.get(key) ?? [];
      arr.push(cat);
      lookup.set(key, arr);
    });
  });
  return lookup;
}

export function AlFatihahDisplay({
  showHighlights = false,
  errorsByCategory,
  defaultShowLatin = true,
  defaultShowTerjemahan = false,
}: Props) {
  const [showLatin, setShowLatin] = useState(defaultShowLatin);
  const [showTerjemahan, setShowTerjemahan] = useState(defaultShowTerjemahan);

  const lookup =
    showHighlights && errorsByCategory ? buildLookup(errorsByCategory) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant={showLatin ? "default" : "outline"}
          size="sm"
          onClick={() => setShowLatin((v) => !v)}
          aria-pressed={showLatin}
        >
          <Languages className="size-4" />
          Latin
        </Button>
        <Button
          type="button"
          variant={showTerjemahan ? "default" : "outline"}
          size="sm"
          onClick={() => setShowTerjemahan((v) => !v)}
          aria-pressed={showTerjemahan}
        >
          <BookOpen className="size-4" />
          Terjemahan
        </Button>
      </div>

      <div className="space-y-4">
        {AL_FATIHAH.map((ayat) => (
          <div key={ayat.number} className="rounded-lg border p-4 bg-card">
            <div className="flex items-baseline gap-2 mb-2 text-xs text-muted-foreground">
              <span>Ayat {ayat.number}</span>
            </div>
            <div
              dir="rtl"
              lang="ar"
              className="text-3xl leading-loose text-right font-arabic"
            >
              {lookup
                ? ayat.words.map((word, idx) => {
                    const cats = lookup.get(`${ayat.number}:${idx}`);
                    const cls = cats?.[0] ? CATEGORY_COLOR[cats[0]] : "";
                    return (
                      <span
                        key={idx}
                        className={
                          cats
                            ? `inline-block px-1 rounded ring-1 mx-0.5 ${cls}`
                            : "inline-block mx-0.5"
                        }
                        title={cats?.join(", ")}
                      >
                        {word}
                      </span>
                    );
                  })
                : ayat.arabic}
            </div>
            {showLatin && (
              <p className="mt-2 text-xs italic text-muted-foreground">
                {ayat.transliterasi}
              </p>
            )}
            {showTerjemahan && (
              <p className="text-sm text-muted-foreground">{ayat.terjemahan}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
