import { Historical, Category } from "./model";
export const categories: Category[] = [
  "dokumen_kurang",
  "dokumen_tidak_sesuai_format",
  "penerimaan_belum_dikonfirmasi",
  "nominal_dipersoalkan",
  "menunggu_persetujuan_internal",
  "terlewat_siklus_bayar",
  "kemungkinan_likuiditas",
  "tidak_diketahui",
];
export function parseCSV(text: string, vendorId: string): Historical[] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quote && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quote = !quote;
    } else if (c === "," && !quote) {
      row.push(field);
      field = "";
    } else if (c === "\n" && !quote) {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quote) throw Error("CSV memiliki tanda kutip yang belum ditutup.");
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const header =
    rows.shift()?.map((x) => x.trim().replace(/^\uFEFF/, "")) ?? [];
  if (new Set(header).size !== header.length)
    throw Error("Header CSV tidak boleh duplikat.");
  const required = [
    "pelanggan",
    "nilai",
    "tanggal_terbit",
    "jatuh_tempo",
    "tanggal_bayar",
    "penyebab",
  ];
  for (const h of required)
    if (!header.includes(h)) throw Error(`Kolom ${h} wajib ada.`);
  return rows
    .filter((r) => r.some(Boolean))
    .map((r, i) => {
      if (r.length !== header.length)
        throw Error(`Baris ${i + 2}: jumlah kolom tidak sesuai header.`);
      const get = (key: string) => r[header.indexOf(key)]?.trim() ?? "";
      const date = (key: string, optional = false) => {
        const v = get(key);
        if (optional && !v) return undefined;
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          !Number.isFinite(Date.parse(v)) ||
          new Date(v).toISOString().slice(0, 10) !== v
        )
          throw Error(`Baris ${i + 2}: tanggal ${key} tidak valid.`);
        return v;
      };
      const value = Number(get("nilai"));
      if (!Number.isFinite(value) || value <= 0 || !get("pelanggan"))
        throw Error(`Baris ${i + 2}: pelanggan/nilai tidak valid.`);
      const cause = get("penyebab") as Category;
      if (!categories.includes(cause))
        throw Error(`Baris ${i + 2}: penyebab tidak dikenal: ${cause}`);
      const issued = date("tanggal_terbit")!;
      const due = date("jatuh_tempo")!;
      const paid = date("tanggal_bayar", true);
      if (due < issued || (paid && paid < issued))
        throw Error(`Baris ${i + 2}: urutan tanggal tidak valid.`);
      const minutes = Number(get("menit_staf") || 0);
      if (!Number.isFinite(minutes) || minutes < 0)
        throw Error("Menit staf harus nonnegatif.");
      return {
        id: `csv-${i}`,
        vendorId,
        buyer: get("pelanggan"),
        value,
        issued,
        due,
        paid,
        cause,
        minutes,
      };
    });
}

// Escape spreadsheet formula prefixes as well as CSV metacharacters.
export function exportCSV(rows: Historical[]): string {
  const cell = (value: string | number) => {
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const header = [
    "pelanggan",
    "nilai",
    "tanggal_terbit",
    "jatuh_tempo",
    "tanggal_bayar",
    "penyebab",
    "menit_staf",
  ];
  return (
    "\uFEFF" +
    [
      header,
      ...rows.map((r) => [
        r.buyer,
        r.value,
        r.issued,
        r.due,
        r.paid || "",
        r.cause,
        r.minutes,
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}
