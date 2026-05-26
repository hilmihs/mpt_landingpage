"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  X,
  Users,
  GraduationCap,
  Calendar,
  Trash2,
  Lock,
  Unlock,
} from "lucide-react";

interface Teacher {
  id: string;
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";
}

interface CohortRow {
  id: string;
  name: string;
  status: string;
  gender_target: string;
  start_date: string;
  end_date: string;
  capacity: number;
  enrolled_count: number;
  teacher_nama: string;
  teacher_id: string;
  session_count: number;
}

interface Props {
  initialCohorts: CohortRow[];
  teachers: Teacher[];
}

interface EligibleSlot {
  id: string;
  scheduled_at: string;
  duration_min: number;
  gender_target: string;
  zoom_join_url: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  open: "var(--success)",
  closed: "var(--warning)",
  in_progress: "var(--accent)",
  completed: "var(--ink-mute)",
  cancelled: "var(--danger)",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  in_progress: "Berjalan",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export function CohortManager({ initialCohorts, teachers }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function createCohort(form: FormData, slotIds: string[]) {
    setError(null);
    setInfo(null);
    if (slotIds.length !== 4) {
      setError("Pilih tepat 4 slot Tahsin.");
      return false;
    }
    const payload = {
      teacher_id: String(form.get("teacher_id") ?? ""),
      name: String(form.get("name") ?? "").trim(),
      start_date: String(form.get("start_date") ?? ""),
      end_date: String(form.get("end_date") ?? ""),
      capacity: Number(form.get("capacity") ?? 12),
      slot_ids: slotIds,
    };
    const res = await fetch("/api/admin/cohort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Gagal membuat cohort.");
      return false;
    }
    setShowCreate(false);
    setInfo(`Cohort "${payload.name}" berhasil dibuat.`);
    startTransition(() => router.refresh());
    return true;
  }

  async function toggleStatus(c: CohortRow, next: "open" | "closed" | "cancelled") {
    const labelMap = { open: "buka kembali", closed: "tutup", cancelled: "batalkan" };
    if (!confirm(`${labelMap[next]} cohort "${c.name}"?`)) return;
    setError(null);
    const res = await fetch(`/api/admin/cohort/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Gagal ubah status.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          {initialCohorts.length} cohort total
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={teachers.length === 0}
          className="btn-mpt btn-mpt-accent"
          style={{
            minHeight: 40,
            fontSize: 13,
            padding: "6px 14px",
            opacity: teachers.length === 0 ? 0.5 : 1,
          }}
        >
          <Plus size={14} strokeWidth={2.4} />
          Buat Cohort Baru
        </button>
      </div>

      {error && <Banner color="danger">{error}</Banner>}
      {info && <Banner color="success">{info}</Banner>}

      {showCreate && (
        <CreateModal
          teachers={teachers}
          onCancel={() => setShowCreate(false)}
          onSubmit={createCohort}
        />
      )}

      {initialCohorts.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {initialCohorts.map((c) => (
            <CohortCard
              key={c.id}
              cohort={c}
              onToggle={toggleStatus}
              pending={pending}
            />
          ))}
        </div>
      )}
    </>
  );
}

function CohortCard({
  cohort: c,
  onToggle,
  pending,
}: {
  cohort: CohortRow;
  onToggle: (c: CohortRow, next: "open" | "closed" | "cancelled") => void;
  pending: boolean;
}) {
  const statusColor = STATUS_COLOR[c.status] ?? "var(--ink-mute)";
  const canReopen = c.status === "closed";
  const canClose = c.status === "open";
  const canCancel = c.status !== "cancelled" && c.status !== "completed";
  const dateRange = `${fmtDate(c.start_date)} – ${fmtDate(c.end_date)}`;

  return (
    <div
      className="card-mpt"
      style={{
        padding: "16px 20px",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 16,
        alignItems: "center",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 6,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/admin/cohort/${c.id}`}
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--ink)",
              textDecoration: "none",
            }}
          >
            {c.name}
          </Link>
          <span
            style={{
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              borderRadius: 5,
              background: `color-mix(in oklab, ${statusColor}, transparent 85%)`,
              color: statusColor,
            }}
          >
            {STATUS_LABEL[c.status] ?? c.status}
          </span>
          <span
            style={{
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              borderRadius: 5,
              background: "color-mix(in oklab, var(--accent), transparent 85%)",
              color: "var(--accent)",
            }}
          >
            {c.gender_target}
          </span>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-soft)",
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <span>{c.teacher_nama}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Calendar size={11} strokeWidth={2.2} />
            {dateRange}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Users size={11} strokeWidth={2.2} />
            {c.enrolled_count}/{c.capacity} peserta
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <GraduationCap size={11} strokeWidth={2.2} />
            {c.session_count}/4 sesi
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {canClose && (
          <IconBtn
            onClick={() => onToggle(c, "closed")}
            disabled={pending}
            icon={<Lock size={13} strokeWidth={2.2} />}
            label="Tutup"
            tone="var(--warning)"
          />
        )}
        {canReopen && (
          <IconBtn
            onClick={() => onToggle(c, "open")}
            disabled={pending}
            icon={<Unlock size={13} strokeWidth={2.2} />}
            label="Buka"
            tone="var(--success)"
          />
        )}
        {canCancel && (
          <IconBtn
            onClick={() => onToggle(c, "cancelled")}
            disabled={pending}
            icon={<Trash2 size={13} strokeWidth={2.2} />}
            label="Batalkan"
            tone="var(--danger)"
          />
        )}
      </div>
    </div>
  );
}

function IconBtn({
  onClick,
  disabled,
  icon,
  label,
  tone,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  tone: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "4px 10px",
        minHeight: 30,
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 6,
        border: `1px solid ${tone}`,
        color: tone,
        background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function CreateModal({
  teachers,
  onCancel,
  onSubmit,
}: {
  teachers: Teacher[];
  onCancel: () => void;
  onSubmit: (fd: FormData, slotIds: string[]) => Promise<boolean>;
}) {
  const [teacherId, setTeacherId] = useState<string>(teachers[0]?.id ?? "");
  const [eligible, setEligible] = useState<EligibleSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const didInitialFetch = useRef(false);

  const fetchEligible = useCallback(async (tId: string) => {
    if (!tId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cohort/eligible-slots?teacher_id=${tId}`);
      const data = await res.json();
      setEligible(data.slots ?? []);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  function handleTeacherChange(newId: string) {
    setTeacherId(newId);
    fetchEligible(newId);
  }

  // Initial fetch on mount only (subsequent changes go through handleTeacherChange).
  useEffect(() => {
    if (!didInitialFetch.current && teacherId) {
      didInitialFetch.current = true;
      fetchEligible(teacherId);
    }
  }, [teacherId, fetchEligible]);

  function toggleSlot(slotId: string) {
    setLocalError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) {
        next.delete(slotId);
      } else {
        if (next.size >= 4) {
          setLocalError("Maksimal 4 slot per cohort.");
          return prev;
        }
        next.add(slotId);
      }
      return next;
    });
  }

  async function handleSubmit(form: FormData) {
    setSaving(true);
    try {
      await onSubmit(form, Array.from(selected));
    } finally {
      setSaving(false);
    }
  }

  // Auto-derive default name + dates from selected slots
  const orderedSelected = eligible.filter((s) => selected.has(s.id));
  const firstSlot = orderedSelected[0];
  const lastSlot = orderedSelected[orderedSelected.length - 1];
  const suggestedStart = firstSlot?.scheduled_at.slice(0, 10) ?? "";
  const suggestedEnd = lastSlot?.scheduled_at.slice(0, 10) ?? "";
  const teacher = teachers.find((t) => t.id === teacherId);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
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
          maxWidth: 600,
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
            Buat Cohort Tahsin
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
          action={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <FormSelect
            label="Pengajar"
            name="teacher_id"
            value={teacherId}
            onChange={handleTeacherChange}
            required
          >
            <option value="">Pilih pengajar</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nama} ({t.jenis_kelamin === "ikhwan" ? "Ikhwan" : "Akhwat"})
              </option>
            ))}
          </FormSelect>

          {teacher && (
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                background: "var(--surface-soft)",
                padding: "8px 12px",
                borderRadius: 8,
                lineHeight: 1.5,
              }}
            >
              Gender target otomatis: <strong>{teacher.jenis_kelamin}</strong>.
              Hanya peserta {teacher.jenis_kelamin} yang bisa enroll.
            </div>
          )}

          <FormField
            label="Nama Cohort"
            name="name"
            type="text"
            placeholder={
              teacher
                ? `Tahsin ${teacher.jenis_kelamin === "ikhwan" ? "Ikhwan" : "Akhwat"} — ${monthIDLabel(suggestedStart || new Date().toISOString().slice(0, 10))}`
                : "Tahsin Akhwat — Juni 2026"
            }
            required
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <FormField
              label="Mulai"
              name="start_date"
              type="date"
              defaultValue={suggestedStart}
              key={`start-${suggestedStart}`}
              required
            />
            <FormField
              label="Selesai"
              name="end_date"
              type="date"
              defaultValue={suggestedEnd}
              key={`end-${suggestedEnd}`}
              required
            />
            <FormField
              label="Kapasitas"
              name="capacity"
              type="number"
              defaultValue="12"
              min={1}
              max={12}
              required
            />
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
                marginBottom: 8,
              }}
            >
              Pilih 4 Slot Tahsin ({selected.size}/4 terpilih)
            </div>

            {loading ? (
              <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: 12 }}>
                Memuat slot...
              </div>
            ) : eligible.length === 0 ? (
              <div
                style={{
                  padding: "16px 14px",
                  background: "var(--surface-soft)",
                  border: "1px dashed var(--line)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--ink-soft)",
                  lineHeight: 1.5,
                }}
              >
                Tidak ada slot Tahsin yang tersedia. Pastikan pengajar sudah set
                window <code>kind=tahsin</code> di portal, lalu admin
                generate-slot dulu.
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  maxHeight: 240,
                  overflow: "auto",
                }}
              >
                {eligible.map((s) => (
                  <SlotRow
                    key={s.id}
                    slot={s}
                    selected={selected.has(s.id)}
                    onToggle={() => toggleSlot(s.id)}
                  />
                ))}
              </div>
            )}

            {localError && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--danger)",
                  marginTop: 6,
                }}
              >
                {localError}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 6,
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
              disabled={saving || selected.size !== 4}
              className="btn-mpt btn-mpt-accent"
              style={{
                minHeight: 40,
                fontSize: 13,
                opacity: saving || selected.size !== 4 ? 0.5 : 1,
              }}
            >
              {saving ? "Menyimpan..." : "Buat Cohort"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  selected,
  onToggle,
}: {
  slot: EligibleSlot;
  selected: boolean;
  onToggle: () => void;
}) {
  const d = new Date(slot.scheduled_at);
  const dateStr = d.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;

  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        background: selected ? "color-mix(in oklab, var(--accent), transparent 90%)" : "transparent",
        border: "none",
        borderBottom: "1px solid var(--line)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: `2px solid ${selected ? "var(--accent)" : "var(--ink-mute)"}`,
          background: selected ? "var(--accent)" : "transparent",
          display: "grid",
          placeItems: "center",
          color: "white",
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        {selected && "✓"}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          {dateStr} · {time}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
          {slot.duration_min} menit · {slot.gender_target}
          {slot.zoom_join_url && " · Zoom ready"}
        </div>
      </div>
    </button>
  );
}

function fmtDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function monthIDLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function EmptyState() {
  return (
    <div
      className="card-mpt"
      style={{ padding: "48px 28px", textAlign: "center" }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          margin: "0 auto 16px",
          borderRadius: 14,
          background: "color-mix(in oklab, var(--accent), transparent 85%)",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <GraduationCap size={24} strokeWidth={2.2} />
      </div>
      <h2
        className="font-display"
        style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}
      >
        Belum ada cohort
      </h2>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
        Klik <strong>Buat Cohort Baru</strong> untuk membuat cohort Tahsin pertama. Setiap
        cohort terdiri dari 4 sesi × 90 menit.
      </p>
    </div>
  );
}

function FormField({
  label,
  name,
  type,
  required,
  placeholder,
  defaultValue,
  min,
  max,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  min?: number;
  max?: number;
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
        defaultValue={defaultValue}
        min={min}
        max={max}
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

function FormSelect({
  label,
  name,
  value,
  onChange,
  required,
  children,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
