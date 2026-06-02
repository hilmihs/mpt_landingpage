"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Video,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  CircleHelp,
} from "lucide-react";

export interface SessionRow {
  id: string;
  session_number: number;
  scheduled_at: string;
  duration_min: number;
  status: string;
  zoom_join_url: string | null;
}

export interface EnrolledPeserta {
  submission_id: string;
  nama: string;
  nomor_wa: string;
}

/**
 * Attendance state per (cohort_session_id, submission_id) pair.
 * `null` = no attendance row yet (peserta hasn't been marked).
 */
export interface AttendanceMap {
  [key: string]: boolean | null;
}

interface Props {
  sessions: SessionRow[];
  peserta: EnrolledPeserta[];
  attendance: AttendanceMap;
  nowMs: number;
}

const SLOT_STATUS_COLOR: Record<string, string> = {
  scheduled: "var(--success)",
  in_progress: "var(--accent)",
  completed: "var(--ink-mute)",
  cancelled: "var(--danger)",
};

function makeKey(sessionId: string, submissionId: string): string {
  return `${sessionId}:${submissionId}`;
}

export function SessionAttendanceEditor({
  sessions,
  peserta,
  attendance: initialAttendance,
  nowMs,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [attendance, setAttendance] = useState<AttendanceMap>(initialAttendance);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleExpand(sessionId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  async function mark(
    sessionId: string,
    submissionId: string,
    attended: boolean,
  ) {
    const key = makeKey(sessionId, submissionId);
    setError(null);
    setUpdatingKey(key);
    // Optimistic update
    const prev = attendance[key];
    setAttendance((a) => ({ ...a, [key]: attended }));
    try {
      const res = await fetch("/api/portal/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohort_session_id: sessionId,
          submission_id: submissionId,
          attended,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Rollback
        setAttendance((a) => ({ ...a, [key]: prev ?? null }));
        setError(data.message ?? "Gagal menyimpan kehadiran.");
        return;
      }
      // Refresh server data so progress bar / qualified count update
      startTransition(() => router.refresh());
    } catch {
      setAttendance((a) => ({ ...a, [key]: prev ?? null }));
      setError("Koneksi gagal. Coba lagi.");
    } finally {
      setUpdatingKey(null);
    }
  }

  return (
    <>
      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "color-mix(in oklab, var(--danger), transparent 88%)",
            color: "var(--danger)",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sessions.map((s) => {
          const d = new Date(s.scheduled_at);
          const isPast = d.getTime() < nowMs;
          const isExpanded = expanded.has(s.id);
          const attendedCount = peserta.filter(
            (p) => attendance[makeKey(s.id, p.submission_id)] === true,
          ).length;
          const unreviewedCount = peserta.filter(
            (p) => attendance[makeKey(s.id, p.submission_id)] === null,
          ).length;

          return (
            <div
              key={s.id}
              className="card-mpt"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <button
                type="button"
                onClick={() => isPast && toggleExpand(s.id)}
                disabled={!isPast}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto",
                  gap: 14,
                  alignItems: "center",
                  background: isExpanded
                    ? "color-mix(in oklab, var(--accent), transparent 95%)"
                    : "transparent",
                  border: "none",
                  cursor: isPast ? "pointer" : "default",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background:
                      "color-mix(in oklab, var(--accent), transparent 85%)",
                    color: "var(--accent)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  {s.session_number}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {d.toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-soft)",
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      marginTop: 2,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} strokeWidth={2.2} />
                      {`${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`}
                    </span>
                    <span>{s.duration_min}m</span>
                    {isPast && (
                      <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                        {attendedCount}/{peserta.length} hadir
                        {unreviewedCount > 0 && (
                          <span style={{ color: "var(--warning)", marginLeft: 6 }}>
                            · {unreviewedCount} belum direview
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                {s.zoom_join_url && (
                  <a
                    href={s.zoom_join_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Zoom"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background:
                        "color-mix(in oklab, var(--accent), transparent 85%)",
                      color: "var(--accent)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Video size={14} strokeWidth={2.2} />
                  </a>
                )}
                {isPast ? (
                  isExpanded ? (
                    <ChevronUp size={14} strokeWidth={2.4} color="var(--ink-mute)" />
                  ) : (
                    <ChevronDown size={14} strokeWidth={2.4} color="var(--ink-mute)" />
                  )
                ) : (
                  <Calendar
                    size={14}
                    strokeWidth={2.2}
                    color={SLOT_STATUS_COLOR[s.status] ?? "var(--ink-mute)"}
                  />
                )}
              </button>

              {isPast && isExpanded && (
                <div
                  style={{
                    borderTop: "1px solid var(--line)",
                    background: "var(--surface-soft)",
                    padding: "12px 14px",
                  }}
                >
                  {peserta.length === 0 ? (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--ink-soft)",
                        margin: 0,
                        textAlign: "center",
                        padding: 12,
                      }}
                    >
                      Belum ada peserta enroll di cohort ini.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {peserta.map((p) => {
                        const key = makeKey(s.id, p.submission_id);
                        const state = attendance[key] ?? null;
                        const isUpdating =
                          updatingKey === key || (pending && updatingKey === null);
                        return (
                          <PesertaRow
                            key={p.submission_id}
                            peserta={p}
                            state={state}
                            disabled={isUpdating}
                            onMark={(attended) =>
                              mark(s.id, p.submission_id, attended)
                            }
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function PesertaRow({
  peserta,
  state,
  disabled,
  onMark,
}: {
  peserta: EnrolledPeserta;
  state: boolean | null;
  disabled: boolean;
  onMark: (attended: boolean) => void;
}) {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: "var(--surface)",
        borderRadius: 8,
        border: "1px solid var(--line)",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          {peserta.nama}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
          {peserta.nomor_wa}
          {state === null && (
            <span
              style={{
                marginLeft: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                color: "var(--warning)",
                fontWeight: 600,
              }}
            >
              <CircleHelp size={10} strokeWidth={2.2} />
              Belum direview
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        <button
          type="button"
          onClick={() => onMark(true)}
          disabled={disabled}
          aria-label="Tandai hadir"
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            border: `1.5px solid ${state === true ? "var(--success)" : "var(--line)"}`,
            background:
              state === true
                ? "color-mix(in oklab, var(--success), transparent 80%)"
                : "transparent",
            color: state === true ? "var(--success)" : "var(--ink-mute)",
            cursor: disabled ? "not-allowed" : "pointer",
            display: "grid",
            placeItems: "center",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Check size={13} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          onClick={() => onMark(false)}
          disabled={disabled}
          aria-label="Tidak hadir"
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            border: `1.5px solid ${state === false ? "var(--danger)" : "var(--line)"}`,
            background:
              state === false
                ? "color-mix(in oklab, var(--danger), transparent 80%)"
                : "transparent",
            color: state === false ? "var(--danger)" : "var(--ink-mute)",
            cursor: disabled ? "not-allowed" : "pointer",
            display: "grid",
            placeItems: "center",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <X size={13} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
