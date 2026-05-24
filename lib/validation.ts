import { z } from "zod";

export const WA_REGEX = /^(\+62|0|62)[0-9]{8,13}$/;

export const formSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").max(80),
  jenis_kelamin: z.enum(["ikhwan", "akhwat"]),
  nomor_wa: z
    .string()
    .trim()
    .regex(WA_REGEX, "Format nomor WA tidak valid (cth. 081234567890)"),
});

export type FormInput = z.infer<typeof formSchema>;
