"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAssessmentStore } from "@/lib/store";
import { formSchema } from "@/lib/validation";

export default function FormPage() {
  const router = useRouter();
  const audioBlob = useAssessmentStore((s) => s.audioBlob);
  const audioDurationSec = useAssessmentStore((s) => s.audioDurationSec);
  const formData = useAssessmentStore((s) => s.formData);
  const setFormData = useAssessmentStore((s) => s.setFormData);
  const setSubmission = useAssessmentStore((s) => s.setSubmission);

  const [nama, setNama] = useState(formData.nama ?? "");
  const [jk, setJk] = useState<"ikhwan" | "akhwat" | "">(
    formData.jenis_kelamin ?? "",
  );
  const [wa, setWa] = useState(formData.nomor_wa ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!audioBlob) router.replace("/assessment/record");
  }, [audioBlob, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = formSchema.safeParse({
      nama,
      jenis_kelamin: jk,
      nomor_wa: wa,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Form tidak valid");
      return;
    }
    if (!audioBlob) {
      setError("Audio tidak ditemukan, mohon rekam ulang.");
      return;
    }

    setFormData(parsed.data);
    setSubmitting(true);

    const fd = new FormData();
    fd.append("audio", audioBlob, "recording.webm");
    fd.append("nama", parsed.data.nama);
    fd.append("jenis_kelamin", parsed.data.jenis_kelamin);
    fd.append("nomor_wa", parsed.data.nomor_wa);
    fd.append("audio_duration_sec", String(audioDurationSec));

    try {
      const res = await fetch("/api/submit", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setSubmission(json.submission_id, json.rapot_slug);
      router.push(`/assessment/loading/${json.rapot_slug}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Data Peserta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="nama">Nama lengkap</Label>
              <Input
                id="nama"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Nama Anda"
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label>Jenis kelamin</Label>
              <RadioGroup
                value={jk}
                onValueChange={(v) => setJk(v as "ikhwan" | "akhwat")}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ikhwan" id="jk-i" />
                  <Label htmlFor="jk-i" className="font-normal">
                    Laki-laki
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="akhwat" id="jk-a" />
                  <Label htmlFor="jk-a" className="font-normal">
                    Perempuan
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wa">Nomor WhatsApp</Label>
              <Input
                id="wa"
                type="tel"
                inputMode="tel"
                value={wa}
                onChange={(e) => setWa(e.target.value)}
                placeholder="081234567890"
                required
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Contoh: 081234567890 atau +6281234567890
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={submitting}
              size="lg"
              className="w-full min-h-12"
            >
              {submitting ? "Mengirim..." : "Kirim & Mulai Analisis"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
