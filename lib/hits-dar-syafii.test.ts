import { describe, expect, it } from "vitest";
import {
  BATAS_JALIY_BUTA_HURUF,
  formulaButaHuruf,
  jawabSchema,
  levelPenempatan,
  penilaianSchema,
  tanyaSchema,
} from "./hits-dar-syafii";

describe("formulaButaHuruf — sama dengan =IF(L7 > 5, …) di spreadsheet lajnah", () => {
  it("lebih dari ambang → buta huruf", () => {
    expect(formulaButaHuruf(BATAS_JALIY_BUTA_HURUF + 1)).toBe(true);
    expect(formulaButaHuruf(34)).toBe(true);
  });

  it("tepat di ambang atau di bawahnya → tidak", () => {
    expect(formulaButaHuruf(BATAS_JALIY_BUTA_HURUF)).toBe(false);
    expect(formulaButaHuruf(4)).toBe(false);
    expect(formulaButaHuruf(0)).toBe(false);
  });

  it("belum dinilai → null, seperti isblank() yang mengosongkan sel", () => {
    expect(formulaButaHuruf(null)).toBeNull();
  });
});

describe("levelPenempatan — cermin kolom generated di migrasi 0015", () => {
  it("Lanjutan yang dinilai buta huruf masuk Dasar", () => {
    expect(levelPenempatan("lanjutan", true)).toBe("dasar");
  });

  it("Lanjutan yang lolos atau belum dinilai tetap Lanjutan", () => {
    expect(levelPenempatan("lanjutan", false)).toBe("lanjutan");
    expect(levelPenempatan("lanjutan", null)).toBe("lanjutan");
  });

  it("level lain tidak pernah dipindah", () => {
    expect(levelPenempatan("dasar", true)).toBe("dasar");
    expect(levelPenempatan("alumni", true)).toBe("alumni");
  });
});

describe("penilaianSchema", () => {
  const sah = {
    id: "5d1c2d4e-9a8b-4c3d-8e7f-1a2b3c4d5e6f",
    lahn_jaliy: "14",
    lahn_khofi: "1",
    buta_huruf: "ya",
    keterangan: "  Peserta membaca Maryam 1-5  ",
  };

  it("menerima isian dari formulir dan merapikannya", () => {
    const r = penilaianSchema.parse(sah);
    expect(r).toEqual({
      id: sah.id,
      lahn_jaliy: 14,
      lahn_khofi: 1,
      buta_huruf: true,
      keterangan: "Peserta membaca Maryam 1-5",
    });
  });

  it("keterangan kosong disimpan null", () => {
    expect(penilaianSchema.parse({ ...sah, keterangan: "   " }).keterangan).toBeNull();
    expect(penilaianSchema.parse({ ...sah, buta_huruf: "tidak" }).buta_huruf).toBe(false);
  });

  it("menolak angka negatif, pecahan, dan pilihan buta huruf yang kosong", () => {
    expect(penilaianSchema.safeParse({ ...sah, lahn_jaliy: "-1" }).success).toBe(false);
    expect(penilaianSchema.safeParse({ ...sah, lahn_khofi: "1.5" }).success).toBe(false);
    expect(penilaianSchema.safeParse({ ...sah, lahn_jaliy: "" }).success).toBe(false);
    expect(penilaianSchema.safeParse({ ...sah, buta_huruf: "" }).success).toBe(false);
  });

  it("menolak keterangan yang lebih panjang dari kolom database", () => {
    expect(penilaianSchema.safeParse({ ...sah, keterangan: "a".repeat(501) }).success).toBe(false);
  });
});

describe("tanyaSchema", () => {
  const sah = { nama: "Fulan", nomor_wa: "0812-3456-7890", pertanyaan: "Apakah ada biaya?" };

  it("menerima pertanyaan wajar", () => {
    expect(tanyaSchema.safeParse(sah).success).toBe(true);
  });

  it("menolak pertanyaan terlalu pendek atau terlalu panjang", () => {
    expect(tanyaSchema.safeParse({ ...sah, pertanyaan: "?" }).success).toBe(false);
    expect(tanyaSchema.safeParse({ ...sah, pertanyaan: "a".repeat(1001) }).success).toBe(false);
  });

  it("menolak nomor yang bukan nomor Indonesia", () => {
    expect(tanyaSchema.safeParse({ ...sah, nomor_wa: "12345" }).success).toBe(false);
  });
});

describe("jawabSchema", () => {
  const id = "5d1c2d4e-9a8b-4c3d-8e7f-1a2b3c4d5e6f";

  it("jawaban wajib diisi", () => {
    expect(jawabSchema.safeParse({ id, jawaban: "  ", tampil_faq: false }).success).toBe(false);
    expect(jawabSchema.parse({ id, jawaban: " Tidak ada. ", tampil_faq: true })).toEqual({
      id,
      jawaban: "Tidak ada.",
      tampil_faq: true,
    });
  });
});
