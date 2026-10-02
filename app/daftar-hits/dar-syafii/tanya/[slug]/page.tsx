import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import s from "@/components/hits-dar-syafii/dar-syafii.module.css";
import t from "@/components/hits-dar-syafii/tanya.module.css";
import { TanyaShell } from "@/components/hits-dar-syafii/TanyaShell";
import { DAR_SYAFII } from "@/lib/hits-dar-syafii";
import { fetchPertanyaanBySlug } from "@/lib/hits-tanya";

// Tautan pribadi penanya: jangan diindeks, dan jangan bocorkan isi
// pertanyaan di pratinjau tautan WhatsApp.
export const metadata: Metadata = {
  title: `Jawaban pertanyaan — ${DAR_SYAFII.nama}`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const tgl = (d: Date) =>
  d.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" });

export default async function JawabanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const q = await fetchPertanyaanBySlug(slug);
  if (!q) notFound();

  const dijawab = q.jawaban !== null;

  return (
    <TanyaShell
      eyebrow="Tanya admin"
      title={dijawab ? <>Pertanyaan Anda <em>sudah dijawab</em></> : <>Menunggu <em>jawaban</em></>}
      desc={
        dijawab
          ? undefined
          : "Simpan tautan halaman ini. Kami kabari lewat WhatsApp saat admin sudah menjawab — biasanya dalam 1–2 hari."
      }
    >
      <div className={t.stack}>
        <span className={t.status} data-state={dijawab ? "dijawab" : "menunggu"}>
          {dijawab ? <CheckCircle2 size={14} strokeWidth={2.6} /> : <Clock size={14} strokeWidth={2.6} />}
          {dijawab ? "Sudah dijawab" : "Belum dijawab"}
        </span>

        <section className={t.card} aria-label="Pertanyaan">
          <div className={s.eyebrow}>Pertanyaan {q.nama}</div>
          <p className={t.quote}>{q.pertanyaan}</p>
          <span className={t.meta}>Dikirim {tgl(q.created_at)} WIB</span>
        </section>

        {dijawab && (
          <section className={t.card} aria-label="Jawaban admin">
            <div className={s.eyebrow}>Jawaban admin</div>
            <p className={t.answer}>{q.jawaban}</p>
            {q.dijawab_at && <span className={t.meta}>Dijawab {tgl(q.dijawab_at)} WIB</span>}
          </section>
        )}

        <Link href="/daftar-hits/dar-syafii" className={`${s.btnGold} ${s.btnBlock}`}>
          Ke halaman pendaftaran
        </Link>
        <Link href="/daftar-hits/dar-syafii/tanya" className={`${s.btnGhost} ${s.btnBlock}`}>
          Kirim pertanyaan lain
        </Link>
      </div>
    </TanyaShell>
  );
}
