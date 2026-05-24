"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useRapotPolling } from "@/hooks/useRapotPolling";
import { Loader2, AlertTriangle, Zap } from "lucide-react";

const BYPASS_ENABLED = process.env.NEXT_PUBLIC_ALLOW_BYPASS === "1";

export default function LoadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, networkError } = useRapotPolling(id);
  const [bypassing, setBypassing] = useState(false);
  const [bypassError, setBypassError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.status === "completed") {
      router.replace(`/rapot/${id}`);
    }
  }, [data, id, router]);

  const isFailed = data?.status === "failed";

  const handleBypass = async () => {
    setBypassError(null);
    setBypassing(true);
    try {
      const res = await fetch(`/api/bypass/${id}`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setBypassError((err as Error).message);
      setBypassing(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardContent className="pt-8 pb-6 space-y-6 text-center">
          {!isFailed ? (
            <>
              <Loader2 className="size-12 mx-auto animate-spin text-primary" />
              <div>
                <h2 className="text-xl font-semibold">Menganalisis bacaan...</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  AI Mu&apos;alim sedang menilai bacaan Anda dari 4 sisi. Mohon
                  tunggu sebentar (±30 detik).
                </p>
              </div>
              <Progress
                value={
                  data?.status === "processing"
                    ? 60
                    : data?.status === "pending"
                      ? 20
                      : 10
                }
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                Status:{" "}
                <span className="font-mono">{data?.status ?? "menghubungi server..."}</span>
              </p>
              {networkError && (
                <p className="text-xs text-amber-600">
                  Koneksi terganggu, mencoba ulang...
                </p>
              )}
              {BYPASS_ENABLED && (
                <div className="pt-4 border-t space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBypass}
                    disabled={bypassing}
                    className="w-full"
                  >
                    <Zap className="size-4" />
                    {bypassing
                      ? "Menyiapkan rapot acak..."
                      : "Lewati & buat rapot acak (dev)"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    ML server belum aktif — tombol ini men-generate hasil acak
                    untuk preview.
                  </p>
                  {bypassError && (
                    <p className="text-xs text-destructive">{bypassError}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <Alert variant="destructive" className="text-left">
              <AlertTriangle className="size-4" />
              <AlertTitle>Analisis gagal</AlertTitle>
              <AlertDescription>
                {data?.error_message ?? "Terjadi kesalahan saat memproses."}
                <br />
                Silakan rekam ulang dan coba lagi.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
