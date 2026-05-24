import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Mic, BookOpen, Award } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:py-20">
      <section className="text-center space-y-6">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          Muhajir Project Tilawah
        </p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance">
          Cek kualitas bacaan <em className="not-italic font-bold">Al-Fatihah</em> Anda
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
          Rekam bacaan Al-Fatihah Anda, dapatkan analisis 4 jenis kesalahan baca
          (Tanda Baca, Pengucapan Huruf, Panjang Pendek, Penekanan Huruf), dan
          rapot pribadi dalam 30 detik.
        </p>
        <div className="flex justify-center gap-3 pt-4">
          <Button asChild size="lg" className="min-h-12 px-8 text-base">
            <Link href="/assessment/consent">
              Mulai Assessment
              <Mic className="size-4 ml-2" />
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Gratis · Privasi terjaga · Audio dihapus 7 hari
        </p>
      </section>

      <section className="mt-20 grid md:grid-cols-3 gap-6">
        <Feature
          icon={<Mic className="size-6" />}
          title="Rekam"
          desc="Bacakan Al-Fatihah langsung di browser. Maksimal 5 menit."
        />
        <Feature
          icon={<BookOpen className="size-6" />}
          title="Analisis AI"
          desc="Mu'alim AI menilai 4 hal: tanda baca, pengucapan huruf, panjang pendek bacaan, dan penekanan huruf."
        />
        <Feature
          icon={<Award className="size-6" />}
          title="Rapot + Rekomendasi"
          desc="Skor 1–5 dengan rekomendasi lanjut ke Program Perbaikan Bacaan Al-Fatihah."
        />
      </section>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border p-6 bg-card">
      <div className="size-10 rounded-lg bg-muted flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
