"use client";

import { CircleAlert } from "lucide-react";
import s from "./dar-syafii.module.css";

/** Lembar krem di bawah pita hijau kepala langkah. */
export function Sheet({ children }: { children: React.ReactNode }) {
  return <div className={`${s.sheet} ${s.col}`}>{children}</div>;
}

export function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
        {optional && <span className={s.labelOpt}>{optional}</span>}
      </label>
      {children}
      {error ? (
        <span className={s.error} id={`${id}-msg`} role="alert">
          <CircleAlert size={14} strokeWidth={2.4} />
          {error}
        </span>
      ) : hint ? (
        <span className={s.hint} id={`${id}-msg`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
