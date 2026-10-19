import { Profile, Contact, Doc } from "./model";
export function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function requiredText(
  value: unknown,
  label: string,
  max = 2000,
): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw Error(`${label} wajib diisi (maksimum ${max} karakter).`);
  return value.trim();
}
export function numberPattern(value: unknown): RegExp {
  const pattern = requiredText(value, "Pola nomor", 100);
  if (
    /[()|]/.test(pattern) ||
    /\\[1-9]/.test(pattern) ||
    (pattern.match(/[+*]/g) || []).length > 2
  )
    throw Error(
      "Pola nomor terlalu kompleks. Gunakan awalan dan kelas karakter sederhana, tanpa grup atau alternatif.",
    );
  try {
    return new RegExp(pattern);
  } catch {
    throw Error("Pola nomor tidak valid.");
  }
}
export function validateProfile(
  value: unknown,
  contacts: unknown,
): { profile: Profile; contacts: Contact[] } {
  const p = value as Profile;
  if (
    !p ||
    !Array.isArray(p.required) ||
    !p.required.length ||
    p.required.length > 20
  )
    throw Error("Pilih 1–20 dokumen wajib.");
  const required = p.required.map((x) => requiredText(x, "Jenis dokumen", 80));
  if (new Set(required).size !== required.length)
    throw Error("Jenis dokumen wajib tidak boleh duplikat.");
  numberPattern(p.numberPattern);
  if (
    !Array.isArray(p.extensions) ||
    !p.extensions.length ||
    p.extensions.some(
      (x) => typeof x !== "string" || !/^[a-z0-9]{1,10}$/.test(x),
    )
  )
    throw Error("Ekstensi berkas tidak valid.");
  if (!Number.isFinite(p.maxMB) || p.maxMB <= 0 || p.maxMB > 100)
    throw Error("Ukuran maksimum harus 0–100 MB.");
  if (
    ![p.cutoff, p.paymentDay].every(
      (x) => Number.isInteger(x) && x >= 1 && x <= 31,
    )
  )
    throw Error("Tanggal jadwal harus 1–31.");
  if (
    ![p.financeDays, p.exchangeDays].every(
      (a) =>
        Array.isArray(a) &&
        a.length > 0 &&
        a.length <= 7 &&
        a.every((x) => Number.isInteger(x) && x >= 0 && x <= 6),
    )
  )
    throw Error("Hari kerja harus berisi angka 0–6.");
  if (![p.requirePO, p.stamp, p.signature].every((x) => typeof x === "boolean"))
    throw Error("Aturan PO, cap, dan tanda tangan harus boolean.");
  requiredText(p.channel, "Kanal penyerahan", 250);
  if (typeof p.notes !== "string" || p.notes.length > 2000)
    throw Error("Catatan profil terlalu panjang.");
  if (!Array.isArray(contacts) || contacts.length > 30)
    throw Error("Daftar kontak tidak valid.");
  const ids = new Set<string>();
  const cleanContacts: Contact[] = contacts.map((c) => {
    const id = requiredText(c.id, "ID kontak", 100);
    if (ids.has(id)) throw Error("ID kontak duplikat.");
    ids.add(id);
    if (
      !["pengadaan", "penerima_barang", "keuangan_ap", "atasan"].includes(
        c.role,
      )
    )
      throw Error("Peran kontak tidak valid.");
    return {
      id,
      name: requiredText(c.name, "Nama kontak", 100),
      role: c.role,
      channel: requiredText(c.channel, "Kanal kontak", 250),
    };
  });
  return {
    profile: {
      required,
      numberPattern: p.numberPattern,
      requirePO: p.requirePO,
      maxMB: p.maxMB,
      extensions: p.extensions,
      stamp: p.stamp,
      signature: p.signature,
      exchangeDays: [...new Set(p.exchangeDays)],
      financeDays: [...new Set(p.financeDays)],
      cutoff: p.cutoff,
      paymentDay: p.paymentDay,
      channel: p.channel,
      notes: p.notes,
    },
    contacts: cleanContacts,
  };
}
export function documentMetadata(
  value: unknown,
  required: string[],
): Pick<
  Doc,
  | "kind"
  | "filename"
  | "mb"
  | "verification"
  | "stamp"
  | "signature"
  | "poNumber"
  | "note"
> {
  const d = value as Doc;
  if (!d || !required.includes(d.kind))
    throw Error("Jenis dokumen tidak sesuai profil.");
  const filename = requiredText(d.filename, "Nama berkas", 200);
  if (!Number.isFinite(d.mb) || d.mb <= 0 || d.mb > 1000)
    throw Error("Ukuran berkas tidak valid.");
  if (
    !["belum", "cocok", "tidak_cocok"].includes(d.verification) ||
    typeof d.stamp !== "boolean" ||
    typeof d.signature !== "boolean" ||
    typeof d.poNumber !== "string" ||
    d.poNumber.length > 100 ||
    typeof d.note !== "string" ||
    d.note.length > 2000
  )
    throw Error("Metadata atau status verifikasi tidak valid.");
  return {
    kind: d.kind,
    filename,
    mb: d.mb,
    verification: d.verification,
    stamp: d.stamp,
    signature: d.signature,
    poNumber: d.poNumber.trim(),
    note: d.note.trim(),
  };
}
