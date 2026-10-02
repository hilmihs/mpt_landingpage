"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Send } from "lucide-react";
import { tanyaSchema } from "@/lib/hits-dar-syafii";
import s from "./dar-syafii.module.css";
import t from "./tanya.module.css";
import { Field } from "./Shared";

type Key = "nama" | "nomor_wa" | "pertanyaan";
type Errors = Partial<Record<Key, string>>;

const MAKS = 1000;
/**
 * Tautan pertanyaan yang pernah dikirim dari browser ini — hanya kemudahan
 * bagi penanya yang lupa menyimpan tautannya. WhatsApp tetap jalur utamanya.
 */
const RIWAYAT_KEY = "ds-tanya-riwayat";

function bacaRaw(): string | null {
  try {
    return window.localStorage.getItem(RIWAYAT_KEY);
  } catch {
    return null;
  }
}

function parseRiwayat(raw: string | null): string[] {
  try {
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter((x): x is string => typeof x === "string" && x.startsWith("/daftar-hits/dar-syafii/tanya/")).slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function bacaRiwayat(): string[] {
  return parseRiwayat(bacaRaw());
}

const langganStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

function simpanRiwayat(path: string) {
  try {
    const list = [path, ...bacaRiwayat().filter((p) => p !== path)].slice(0, 5);
    window.localStorage.setItem(RIWAYAT_KEY, JSON.stringify(list));
  } catch {
    // Mode privat / penyimpanan diblokir: tidak apa-apa, tautan ada di layar & WA.
  }
}

export function TanyaForm() {
  const [form, setForm] = useState<Record<Key, string>>({ nama: "", nomor_wa: "", pertanyaan: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [kirim, setKirim] = useState<"idle" | "sending">("idle");
  const [gagal, setGagal] = useState<string | null>(null);
  const [hasil, setHasil] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState(false);
  // Snapshot berupa string mentah supaya stabil antar-render; di server kosong.
  const riwayatRaw = useSyncExternalStore(langganStorage, bacaRaw, () => null);
  const riwayat = useMemo(() => parseRiwayat(riwayatRaw), [riwayatRaw]);

  const update = (k: Key, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setGagal(null);
    const parsed = tanyaSchema.safeParse(form);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as Key] ??= issue.message;
      setErrors(next);
      const first = (["nama", "nomor_wa", "pertanyaan"] as const).find((k) => next[k]);
      if (first) document.getElementById(`ds-tanya-${first}`)?.focus();
      return;
    }

    setKirim("sending");
    try {
      const res = await fetch("/api/hits/dar-syafii/tanya", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await res.json().catch(() => ({}))) as {
        path?: string;
        message?: string;
        fields?: Errors;
      };
      if (!res.ok || !body.path) {
        if (body.fields) setErrors(body.fields);
        setGagal(body.message ?? "Pertanyaan belum terkirim. Coba lagi sebentar.");
        return;
      }
      simpanRiwayat(body.path);
      setHasil(`${window.location.origin}${body.path}`);
      window.scrollTo({ top: 0 });
    } catch {
      setGagal("Koneksi terputus. Periksa internet Anda lalu coba lagi.");
    } finally {
      setKirim("idle");
    }
  }

  async function salin() {
    if (!hasil) return;
    try {
      await navigator.clipboard.writeText(hasil);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2500);
    } catch {
      // Clipboard ditolak: tautannya bisa dipilih manual (user-select: all).
    }
  }

  if (hasil) {
    return (
      <div className={t.stack}>
        <div className={t.card} role="status">
          <h2 className={t.cardTitle}>Pertanyaan Anda sudah kami terima</h2>
          <p className={t.cardBody}>
            Jawaban admin akan muncul di tautan di bawah ini. <b>Mohon simpan tautannya</b> dan
            tunggu — saat sudah dijawab, kami kirim tautan yang sama lewat WhatsApp ke nomor Anda.
          </p>
          <div className={t.linkBox}>{hasil}</div>
          <div className={t.actions}>
            <button type="button" className={s.btnGhost} onClick={salin}>
              {tersalin ? <Check size={16} strokeWidth={2.6} /> : <Copy size={16} strokeWidth={2.4} />}
              {tersalin ? "Tersalin" : "Salin tautan"}
            </button>
            <Link href={new URL(hasil).pathname} className={s.btnGreen}>
              Buka tautan
              <ArrowRight size={16} strokeWidth={2.6} />
            </Link>
          </div>
        </div>
        <Link href="/daftar-hits/dar-syafii" className={`${s.btnGold} ${s.btnBlock}`}>
          Kembali ke pendaftaran
        </Link>
      </div>
    );
  }

  return (
    <div className={t.stack}>
      <form className={s.fields} noValidate onSubmit={submit}>
        <Field id="ds-tanya-nama" label="Nama" error={errors.nama}>
          <input
            id="ds-tanya-nama"
            className={s.input}
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Nama Anda"
            value={form.nama}
            onChange={(e) => update("nama", e.target.value)}
            aria-invalid={Boolean(errors.nama)}
            aria-describedby="ds-tanya-nama-msg"
          />
        </Field>

        <Field
          id="ds-tanya-nomor_wa"
          label="Nomor WhatsApp"
          hint="Kami kabari lewat nomor ini saat pertanyaan sudah dijawab."
          error={errors.nomor_wa}
        >
          <input
            id="ds-tanya-nomor_wa"
            className={s.input}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0812 3456 7890"
            value={form.nomor_wa}
            onChange={(e) => update("nomor_wa", e.target.value)}
            aria-invalid={Boolean(errors.nomor_wa)}
            aria-describedby="ds-tanya-nomor_wa-msg"
          />
        </Field>

        <Field id="ds-tanya-pertanyaan" label="Pertanyaan" error={errors.pertanyaan}>
          <textarea
            id="ds-tanya-pertanyaan"
            className={`${s.input} ${t.textarea}`}
            placeholder="Tulis pertanyaan Anda tentang HITS Darsyafii"
            maxLength={MAKS}
            value={form.pertanyaan}
            onChange={(e) => update("pertanyaan", e.target.value)}
            aria-invalid={Boolean(errors.pertanyaan)}
            aria-describedby="ds-tanya-pertanyaan-msg"
          />
          <span className={t.counter} aria-hidden="true">
            {form.pertanyaan.length}/{MAKS}
          </span>
        </Field>

        {gagal && (
          <div className={t.formError} role="alert">
            {gagal}
          </div>
        )}

        <button type="submit" className={`${s.btnGreen} ${s.btnBlock}`} disabled={kirim === "sending"}>
          {kirim === "sending" ? "Mengirim…" : "Kirim pertanyaan"}
          <Send size={17} strokeWidth={2.4} />
        </button>
      </form>

      {riwayat.length > 0 && (
        <div className={t.card}>
          <h2 className={t.cardTitle}>Pertanyaan Anda sebelumnya</h2>
          <ul className={t.list}>
            {riwayat.map((p) => (
              <li key={p}>
                <Link href={p}>Lihat jawaban · {p.split("/").pop()}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
