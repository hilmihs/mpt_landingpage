import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const LINKTREE =
  process.env.NEXT_PUBLIC_LINKTREE_URL ??
  "https://linktr.ee/muhajirprojecttilawah";

/**
 * Single funnel — SEMUA skor (1-5) diarahkan ke Tahsin Al-Fatihah.
 * Jangan beda CTA per skor.
 */
export function CTATahsin() {
  return (
    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 p-6 border border-emerald-200/60 dark:border-emerald-800/60">
      <h3 className="text-xl font-semibold mb-2">
        Lanjutkan ke Program Perbaikan Bacaan Al-Fatihah
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Daftar pendampingan bersama Muhajir Project untuk memperbaiki bacaan
        Al-Fatihah Anda secara terstruktur dan bertahap.
      </p>
      <Button asChild size="lg" className="min-h-11">
        <a href={LINKTREE} target="_blank" rel="noopener noreferrer">
          Daftar Sekarang
          <ExternalLink className="size-4 ml-2" />
        </a>
      </Button>
    </div>
  );
}
