"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { KOTA_OPTIONS, type KotaOption } from "@/lib/kota-indonesia";
import s from "./dar-syafii.module.css";
import k from "./kota-picker.module.css";

/** Saran saat kolom masih kosong. */
const SEKITAR_JAKARTA = [
  "Kota Jakarta Selatan",
  "Kota Jakarta Timur",
  "Kota Jakarta Barat",
  "Kota Jakarta Pusat",
  "Kota Jakarta Utara",
  "Kota Depok",
  "Kota Bekasi",
  "Kota Tangerang Selatan",
];

const norm = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const INDEX = KOTA_OPTIONS.map((o) => ({ ...o, key: norm(`${o.kota} ${o.provinsi}`), kotaKey: norm(o.kota) }));

function search(q: string): KotaOption[] {
  const nq = norm(q);
  if (!nq) return SEKITAR_JAKARTA.map((k) => KOTA_OPTIONS.find((o) => o.kota === k)!).filter(Boolean);
  const words = nq.split(" ");
  const hits = INDEX.filter((o) => words.every((w) => o.key.includes(w)));
  // Yang namanya diawali kata kunci naik ke atas: "bandung" → Bandung, Kota Bandung, lalu Bandung Barat.
  hits.sort((a, b) => {
    const as = a.kotaKey.replace(/^kota /, "").startsWith(nq) ? 0 : 1;
    const bs = b.kotaKey.replace(/^kota /, "").startsWith(nq) ? 0 : 1;
    return as - bs;
  });
  return hits.slice(0, 60);
}

function Highlight({ text, q }: { text: string; q: string }) {
  const nq = norm(q);
  if (!nq) return <>{text}</>;
  const i = text.toLowerCase().indexOf(nq);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + nq.length)}</mark>
      {text.slice(i + nq.length)}
    </>
  );
}

export function KotaPicker({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (kota: string) => void;
  invalid: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const results = useMemo(() => search(query === value ? "" : query), [query, value]);
  const kosong = norm(query === value ? "" : query) === "";

  function pick(o: KotaOption) {
    onChange(o.kota);
    setQuery(o.kota);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => {
        const n = e.key === "ArrowDown" ? Math.min(a + 1, results.length - 1) : Math.max(a - 1, 0);
        listRef.current?.children[n + (kosong ? 1 : 0)]?.scrollIntoView({ block: "nearest" });
        return n;
      });
    } else if (e.key === "Enter") {
      if (open && results[active]) {
        e.preventDefault();
        pick(results[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(value);
    }
  }

  return (
    <div className={k.combo} data-open={open}>
      <input
        ref={inputRef}
        id={id}
        className={`${s.input} ${k.input}`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder="Ketik kota atau kabupaten…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => {
          setOpen(true);
          // Di HP, naikkan isian ke atas layar setelah keyboard muncul supaya
          // daftar saran di bawahnya tidak tertutup keyboard.
          if (window.matchMedia("(pointer: coarse)").matches) {
            window.setTimeout(() => {
              const el = inputRef.current;
              if (el && document.activeElement === el) el.scrollIntoView({ block: "start", behavior: "smooth" });
            }, 300);
          }
        }}
        onBlur={() => {
          // Tunda supaya klik pada item sempat terbaca.
          window.setTimeout(() => {
            setOpen(false);
            setQuery((q) => (value ? value : q));
          }, 150);
        }}
        onKeyDown={onKeyDown}
      />
      {query && (
        <button
          type="button"
          className={k.clear}
          aria-label="Hapus pilihan kota"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery("");
            onChange("");
            setOpen(true);
            inputRef.current?.focus();
          }}
        >
          <X size={16} strokeWidth={2.4} />
        </button>
      )}
      {/* Sesudah tombol hapus: CSS menyembunyikannya selama tombol itu tampil. */}
      <ChevronDown className={k.chev} size={16} strokeWidth={2.2} aria-hidden />
      {open && (
        <ul ref={listRef} id={listId} className={k.list} role="listbox">
          {kosong && <li className={k.head} role="presentation">Pilihan cepat · Jabodetabek</li>}
          {results.length === 0 ? (
            <li className={k.empty} role="presentation">
              Tidak ditemukan. Coba nama kabupaten/kota tanpa singkatan.
            </li>
          ) : (
            results.map((o, i) => (
              <li
                key={`${o.provinsi}-${o.kota}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                data-current={o.kota === value || undefined}
                className={k.item}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
              >
                <span className={k.itemText}>
                  <span className={k.kota}>
                    <Highlight text={o.kota} q={query === value ? "" : query} />
                  </span>
                  <span className={k.prov}>{o.provinsi}</span>
                </span>
                {o.kota === value && <Check className={k.check} size={18} strokeWidth={2.6} aria-hidden />}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
