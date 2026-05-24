import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWord } from "@/lib/arabic";
import { INDIKATOR_LABEL } from "@/lib/scoring";
import type { ErrorItem, IndikatorKey } from "@/types";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  kategori: IndikatorKey;
  errors: ErrorItem[];
}

const ACCENT: Record<IndikatorKey, string> = {
  harakat: "border-amber-500/40",
  huruf: "border-rose-500/40",
  panjang_pendek: "border-sky-500/40",
  syaddah: "border-violet-500/40",
};

export function IndikatorSection({ kategori, errors }: Props) {
  const label = INDIKATOR_LABEL[kategori];
  const major = errors.filter((e) => e.severity === "major").length;
  const minor = errors.filter((e) => e.severity === "minor").length;

  return (
    <Card className={`border-l-4 ${ACCENT[kategori]}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{label}</span>
          {errors.length === 0 ? (
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              <CheckCircle2 className="size-4" />
              Tidak ada koreksi
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm text-amber-700">
              <AlertCircle className="size-4" />
              {errors.length} koreksi
            </span>
          )}
        </CardTitle>
      </CardHeader>
      {errors.length > 0 && (
        <CardContent className="space-y-3">
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Major: {major}</span>
            <span>Minor: {minor}</span>
          </div>
          <ul className="space-y-2">
            {errors.map((e, i) => {
              const word = getWord(e.ayat, e.kata_idx) ?? e.expected;
              return (
                <li
                  key={i}
                  className="flex flex-wrap items-baseline gap-2 text-sm border-l-2 pl-3 py-1"
                >
                  <span className="text-xs text-muted-foreground">
                    Ayat {e.ayat}
                  </span>
                  <span dir="rtl" lang="ar" className="text-xl">
                    {word}
                  </span>
                  <span
                    className={`text-xs rounded px-1.5 py-0.5 ${
                      e.severity === "major"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {e.severity}
                  </span>
                  {e.note && (
                    <span className="text-xs text-muted-foreground">
                      — {e.note}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
