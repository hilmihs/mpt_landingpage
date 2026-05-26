"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Sparkles } from "lucide-react";

interface Teacher {
  id: string;
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";
  nomor_wa: string;
  status: string;
  bio: string | null;
  email_zoom: string | null;
  created_at: string;
}

interface Props {
  initialTeachers: Teacher[];
}

const STATUS_COLOR: Record<string, string> = {
  active: "var(--success)",
  pending: "var(--warning)",
  inactive: "var(--ink-mute)",
  suspended: "var(--danger)",
};

const STATUS_NEXT: Record<string, { label: string; next: string; tone: string }> = {
  active: { label: "Suspend", next: "suspended", tone: "var(--danger)" },
  suspended: { label: "Aktifkan", next: "active", tone: "var(--success)" },
  inactive: { label: "Aktifkan", next: "active", tone: "var(--success)" },
  pending: { label: "Aktifkan", next: "active", tone: "var(--success)" },
};

export function PengajarManager({ initialTeachers }: Props) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  async function invite(form: FormData) {
    setError(null);
    setInfo(null);
    const payload = {
      nama: String(form.get("nama") ?? "").trim(),
      jenis_kelamin: String(form.get("jenis_kelamin") ?? ""),
      nomor_wa: String(form.get("nomor_wa") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      email_zoom: String(form.get("email_zoom") ?? "").trim(),
      bio: String(form.get("bio") ?? "").trim(),
    };
    const res = await fetch("/api/admin/pengajar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Gagal menambah pengajar.");
      return;
    }
    setShowInvite(false);
    setInfo(`Pengajar "${payload.nama}" berhasil ditambahkan.`);
    startTransition(() => router.refresh());
  }

  async function toggleStatus(teacher: Teacher) {
    const next = STATUS_NEXT[teacher.status];
    if (!next) return;
    if (!confirm(`${next.label} pengajar "${teacher.nama}"?`)) return;

    setError(null);
    const res = await fetch(`/api/admin/pengajar/${teacher.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next.next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Gagal mengubah status.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function generateSlots(teacher: Teacher) {
    setError(null);
    setInfo(null);
    setGeneratingFor(teacher.id);
    try {
      const res = await fetch("/api/admin/slots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: teacher.id, weeks_ahead: 4 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Gagal generate slot.");
        return;
      }
      const r = data.results?.[0];
      const errs = r?.errors ?? [];
      setInfo(
        `${teacher.nama}: ${r?.slots_created ?? 0} slot baru dibuat, ${r?.slots_skipped ?? 0} sudah ada.` +
          (errs.length ? ` ${errs.length} error.` : ""),
      );
      startTransition(() => router.refresh());
    } finally {
      setGeneratingFor(null);
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 14,
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="btn-mpt btn-mpt-accent"
          style={{ minHeight: 40, fontSize: 13, padding: "6px 14px" }}
        >
          <Plus size={14} strokeWidth={2.4} />
          Undang Pengajar
        </button>
      </div>

      {error && (
        <Banner color="danger">{error}</Banner>
      )}
      {info && <Banner color="success">{info}</Banner>}

      {showInvite && (
        <InviteModal
          onCancel={() => setShowInvite(false)}
          onSubmit={invite}
          pending={pending}
        />
      )}

      {initialTeachers.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="card-mpt" style={{ padding: 0, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ background: "var(--surface-soft)" }}>
                <Th>Nama</Th>
                <Th>Gender</Th>
                <Th>WhatsApp</Th>
                <Th>Status</Th>
                <Th>Daftar</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {initialTeachers.map((t) => {
                const action = STATUS_NEXT[t.status];
                return (
                  <tr key={t.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <Td bold>
                      {t.nama}
                      {t.email_zoom && (
                        <div style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 400, marginTop: 2 }}>
                          {t.email_zoom}
                        </div>
                      )}
                    </Td>
                    <Td>{t.jenis_kelamin === "ikhwan" ? "Ikhwan" : "Akhwat"}</Td>
                    <Td>{t.nomor_wa}</Td>
                    <Td>
                      <StatusPill status={t.status} />
                    </Td>
                    <Td>
                      {new Date(t.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {t.status === "active" && (
                          <button
                            type="button"
                            onClick={() => generateSlots(t)}
                            disabled={generatingFor === t.id}
                            className="btn-mpt btn-mpt-outline"
                            style={{
                              minHeight: 30,
                              fontSize: 11,
                              padding: "4px 10px",
                              gap: 4,
                            }}
                          >
                            <Sparkles size={12} strokeWidth={2.4} />
                            {generatingFor === t.id ? "Generating..." : "Generate Slot"}
                          </button>
                        )}
                        {action && (
                          <button
                            type="button"
                            onClick={() => toggleStatus(t)}
                            style={{
                              padding: "4px 10px",
                              minHeight: 30,
                              fontSize: 11,
                              fontWeight: 600,
                              borderRadius: 6,
                              border: `1px solid ${action.tone}`,
                              color: action.tone,
                              background: "transparent",
                              cursor: "pointer",
                            }}
                          >
                            {action.label}
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function InviteModal({
  onCancel,
  onSubmit,
  pending,
}: {
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
  pending: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        className="card-mpt"
        style={{
          padding: "26px 24px",
          width: "100%",
          maxWidth: 480,
          maxHeight: "92vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <h2
            className="font-display"
            style={{
              fontSize: 22,
              fontWeight: 800,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Undang Pengajar Baru
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--line)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: "var(--ink-mute)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <form
          action={onSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <FormField label="Nama Lengkap" name="nama" type="text" required placeholder="Contoh: Ahmad Hidayat" />
          <SelectField label="Gender" name="jenis_kelamin" required>
            <option value="">Pilih gender</option>
            <option value="ikhwan">Ikhwan</option>
            <option value="akhwat">Akhwat</option>
          </SelectField>
          <FormField
            label="Nomor WhatsApp"
            name="nomor_wa"
            type="tel"
            required
            placeholder="0812xxxx"
            hint="Akan dipakai untuk login pengajar"
          />
          <FormField
            label="Password Awal"
            name="password"
            type="password"
            required
            placeholder="Minimal 8 karakter"
            hint="Berikan ke pengajar via WA. Pengajar bisa minta admin reset jika lupa."
          />
          <FormField
            label="Email Zoom"
            name="email_zoom"
            type="email"
            placeholder="opsional"
            hint="Email yang dipakai pengajar saat login ke Zoom (untuk match host)"
          />
          <FormField
            label="Bio Singkat"
            name="bio"
            type="text"
            placeholder="opsional"
            hint="Ditampilkan ke peserta saat booking"
          />

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 8,
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              className="btn-mpt btn-mpt-outline"
              style={{ minHeight: 40, fontSize: 13 }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn-mpt btn-mpt-accent"
              style={{
                minHeight: 40,
                fontSize: 13,
                opacity: pending ? 0.6 : 1,
              }}
            >
              {pending ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  name,
  type,
  required,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  placeholder?: string;
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
        {required && <span style={{ color: "var(--danger)" }}> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
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

function SelectField({
  label,
  name,
  required,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  children: React.ReactNode;
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
        {required && <span style={{ color: "var(--danger)" }}> *</span>}
      </span>
      <select
        name={name}
        required={required}
        style={{
          padding: "10px 12px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          fontSize: 14,
          color: "var(--ink)",
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        {children}
      </select>
    </label>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "var(--ink-mute)";
  return (
    <span
      style={{
        padding: "3px 8px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        borderRadius: 6,
        background: `color-mix(in oklab, ${color}, transparent 85%)`,
        color,
      }}
    >
      {status}
    </span>
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
        marginBottom: 14,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="card-mpt"
      style={{ padding: "48px 28px", textAlign: "center" }}
    >
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
        Belum ada pengajar terdaftar. Klik <strong>Undang Pengajar</strong> untuk
        menambahkan yang pertama.
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "10px 16px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-mute)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  bold = false,
}: {
  children: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <td
      style={{
        padding: "12px 16px",
        fontSize: 13,
        color: "var(--ink)",
        fontWeight: bold ? 600 : 400,
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}
