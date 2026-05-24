"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssessmentStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ConsentPage() {
  const router = useRouter();
  const setConsent = useAssessmentStore((s) => s.setConsent);

  const handleAgree = () => {
    setConsent(true);
    router.push("/assessment/record");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Persetujuan Privasi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <p>
            Sebelum memulai, mohon baca dan setujui ketentuan berikut:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Rekaman suara Anda akan disimpan sementara di server kami selama
              maksimal <strong>7 hari</strong>, lalu dihapus otomatis.
            </li>
            <li>
              Audio hanya diproses oleh model AI Mu&apos;alim milik Muhajir
              Project Tilawah. <strong>Tidak dibagikan ke pihak ketiga.</strong>
            </li>
            <li>
              Data nama dan nomor WhatsApp digunakan untuk pengiriman hasil dan
              tindak lanjut Program Perbaikan Bacaan (opsional).
            </li>
            <li>
              Sistem AI dapat melakukan kesalahan. Rapot bersifat referensi,
              bukan pengganti penilaian Ustadz/Ustadzah langsung.
            </li>
          </ul>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/">Batal</Link>
            </Button>
            <Button onClick={handleAgree} className="min-h-11 flex-1">
              Saya setuju, lanjutkan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
