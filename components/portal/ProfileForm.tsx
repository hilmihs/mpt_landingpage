"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

interface Profile {
  nama: string;
  bio: string | null;
  email_zoom: string | null;
  foto_url: string | null;
}

interface Props {
  initial: Profile;
}

export function ProfileForm({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(form: FormData) {
    setError(null);
    setInfo(null);
    setSaving(true);
    try {
      const payload = {
        nama: String(form.get("nama") ?? "").trim(),
        bio: String(form.get("bio") ?? "").trim(),
        email_zoom: String(form.get("email_zoom") ?? "").trim(),
        foto_url: String(form.get("foto_url") ?? "").trim(),
      };
      const res = await fetch("/api/portal/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Gagal menyimpan.");
        return;
      }
      setInfo("Profil tersimpan.");
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      action={save}
      className="card-mpt"
      style={{
        padding: "24px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {info && <Banner color="success">{info}</Banner>}
      {error && <Banner color="danger">{error}</Banner>}

      <Field
        label="Nama Lengkap"
        name="nama"
        type="text"
        defaultValue={initial.nama}
        required
      />
      <Field
        label="Email Zoom"
        name="email_zoom"
        type="email"
        defaultValue={initial.email_zoom ?? ""}
        hint="Email yang dipakai saat login ke Zoom. Penting untuk auto-attendance via webhook."
      />
      <Field
        label="URL Foto"
        name="foto_url"
        type="url"
        defaultValue={initial.foto_url ?? ""}
        hint="Opsional. Boleh kosong."
      />
      <TextareaField
        label="Bio Singkat"
        name="bio"
        defaultValue={initial.bio ?? ""}
        hint="Maksimal 500 karakter. Ditampilkan ke peserta saat booking."
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <button
          type="submit"
          disabled={saving || pending}
          className="btn-mpt btn-mpt-accent"
          style={{
            minHeight: 42,
            fontSize: 13,
            padding: "8px 18px",
            opacity: saving || pending ? 0.6 : 1,
          }}
        >
          <Save size={14} strokeWidth={2.4} />
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  defaultValue,
  required,
  hint,
}: {
  label: string;
  name: string;
  type: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        style={{
          padding: "10px 12px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          fontSize: 14,
          color: "var(--ink)",
          fontFamily: "inherit",
        }}
      />
      {hint && (
        <span style={{ fontSize: 10.5, color: "var(--ink-mute)", lineHeight: 1.45 }}>
          {hint}
        </span>
      )}
    </label>
  );
}

function TextareaField({
  label,
  name,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        {label}
      </span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={4}
        style={{
          padding: "10px 12px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          fontSize: 14,
          color: "var(--ink)",
          fontFamily: "inherit",
          resize: "vertical",
        }}
      />
      {hint && (
        <span style={{ fontSize: 10.5, color: "var(--ink-mute)", lineHeight: 1.45 }}>
          {hint}
        </span>
      )}
    </label>
  );
}

function Banner({
  color,
  children,
}: {
  color: "danger" | "success";
  children: React.ReactNode;
}) {
  const c = color === "danger" ? "var(--danger)" : "var(--success)";
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: `color-mix(in oklab, ${c}, transparent 88%)`,
        color: c,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
