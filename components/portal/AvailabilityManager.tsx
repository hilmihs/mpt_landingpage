"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Clock } from "lucide-react";

interface Window {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  kind: "assessment" | "tahsin";
  is_active: boolean;
}

interface Props {
  initialWindows: Window[];
}

const DAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

export function AvailabilityManager({ initialWindows }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function add(form: FormData) {
    setError(null);
    const payload = {
      day_of_week: Number(form.get("day_of_week")),
      start_time: String(form.get("start_time")),
      end_time: String(form.get("end_time")),
      kind: String(form.get("kind")) as "assessment" | "tahsin",
    };

    const res = await fetch("/api/portal/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Gagal menambah ketersediaan.");
      return;
    }
    setShowForm(false);
    startTransition(() => router.refresh());
  }

  async function remove(id: string) {
    if (!confirm("Hapus jadwal ketersediaan ini?")) return;
    const res = await fetch(`/api/portal/availability?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "Gagal menghapus.");
      return;
    }
    startTransition(() => router.refresh());
  }

  const grouped = initialWindows.reduce((acc, w) => {
    if (!acc[w.day_of_week]) acc[w.day_of_week] = [];
    acc[w.day_of_week]!.push(w);
    return acc;
  }, {} as Record<number, Window[]>);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div>
          <h2
            className="font-display"
            style={{
              fontSize: 20,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Window Mingguan
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              margin: "4px 0 0",
            }}
          >
            Sistem akan generate slot konkret dari window ini setiap minggu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="btn-mpt btn-mpt-accent"
          style={{ minHeight: 38, fontSize: 13, padding: "6px 14px" }}
        >
          <Plus size={14} strokeWidth={2.4} />
          Tambah
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "color-mix(in oklab, var(--danger), transparent 90%)",
            color: "var(--danger)",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      {showForm && (
        <form
          action={add}
          className="card-mpt"
          style={{
            padding: "20px 18px",
            marginBottom: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr)) auto",
            gap: 12,
            alignItems: "end",
          }}
        >
          <Select label="Hari" name="day_of_week" defaultValue="1">
            {DAYS.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </Select>
          <Field
            label="Mulai"
            name="start_time"
            type="time"
            defaultValue="19:30"
          />
          <Field label="Selesai" name="end_time" type="time" defaultValue="21:30" />
          <Select label="Jenis" name="kind" defaultValue="assessment">
            <option value="assessment">Assessment (60min)</option>
            <option value="tahsin">Tahsin (90min)</option>
          </Select>
          <button
            type="submit"
            disabled={pending}
            className="btn-mpt btn-mpt-accent"
            style={{ minHeight: 42, fontSize: 13, opacity: pending ? 0.6 : 1 }}
          >
            Simpan
          </button>
        </form>
      )}

      {initialWindows.length === 0 ? (
        <div
          className="card-mpt"
          style={{
            padding: "40px 24px",
            textAlign: "center",
            color: "var(--ink-soft)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              margin: "0 auto 12px",
              borderRadius: 12,
              background: "color-mix(in oklab, var(--accent), transparent 88%)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Clock size={20} strokeWidth={2.2} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            Belum ada jadwal ketersediaan
          </div>
          <div style={{ fontSize: 12 }}>
            Tambahkan minimal 1 window agar peserta bisa booking slot Anda.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {DAYS.map((day, i) =>
            grouped[i] && grouped[i]!.length > 0 ? (
              <div key={i}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ink-mute)",
                    marginBottom: 8,
                  }}
                >
                  {day}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {grouped[i]!.map((w) => (
                    <div
                      key={w.id}
                      className="card-mpt"
                      style={{
                        padding: "12px 16px",
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto auto",
                        gap: 14,
                        alignItems: "center",
                      }}
                    >
                      <Clock size={16} strokeWidth={2.2} color="var(--accent)" />
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--ink)",
                        }}
                      >
                        {w.start_time.slice(0, 5)} – {w.end_time.slice(0, 5)}
                      </div>
                      <div
                        style={{
                          padding: "3px 8px",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          borderRadius: 6,
                          background:
                            w.kind === "assessment"
                              ? "color-mix(in oklab, var(--accent), transparent 85%)"
                              : "color-mix(in oklab, var(--success), transparent 85%)",
                          color:
                            w.kind === "assessment"
                              ? "var(--accent)"
                              : "var(--success)",
                        }}
                      >
                        {w.kind === "assessment" ? "Assessment 60m" : "Tahsin 90m"}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(w.id)}
                        aria-label="Hapus"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: "1px solid var(--line)",
                          background: "transparent",
                          color: "var(--danger)",
                          cursor: "pointer",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Trash2 size={14} strokeWidth={2.2} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type,
  defaultValue,
}: {
  label: string;
  name: string;
  type: string;
  defaultValue?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
        required
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
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
      <select
        name={name}
        defaultValue={defaultValue}
        required
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
