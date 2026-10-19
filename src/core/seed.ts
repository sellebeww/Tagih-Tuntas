import { DB, Category, Doc } from "./model";
export function seed(): DB {
  const db: DB = {
    vendors: [],
    buyers: [],
    orders: [],
    invoices: [],
    links: [],
    history: [],
  };
  const names = [
    "Cetak Cemerlang",
    "Panggung Nusantara",
    "ATK Sentosa",
    "Dapur Bersama",
    "Seragam Prima",
  ];
  const causes: Category[] = [
    "dokumen_kurang",
    "terlewat_siklus_bayar",
    "penerimaan_belum_dikonfirmasi",
    "nominal_dipersoalkan",
    "kemungkinan_likuiditas",
    "tidak_diketahui",
  ];
  names.forEach((name, v) => {
    const vendorId = `v${v + 1}`;
    db.vendors.push({ id: vendorId, name });
    for (let b = 0; b < 4; b++)
      db.buyers.push({
        id: `b${v}-${b}`,
        vendorId,
        name:
          [
            "PT Arunika Niaga",
            "PT Bumi Karya",
            "PT Cakra Digital",
            "PT Daya Logistik",
          ][b] + ` ${v + 1}`,
        terms: 30 + b * 5,
        lateRate: b === 0 ? 0.7 : 0.6,
        profile: {
          required: ["PO", "BAST", "Faktur pajak", "Invoice"],
          numberPattern: "^INV-",
          requirePO: true,
          maxMB: 5,
          extensions: ["pdf"],
          stamp: b % 2 === 0,
          signature: true,
          exchangeDays: [1, 2, 3, 4, 5],
          financeDays: [1, 2, 3, 4, 5],
          cutoff: 10 + b * 2,
          paymentDay: 25 + b,
          channel: `ap${b}@contoh.invalid`,
          notes: "Asumsi seed: jadwal bulanan; verifikasi kembali dengan AP.",
        },
        contacts: ["pengadaan", "penerima_barang", "keuangan_ap", "atasan"].map(
          (role, c) => ({
            id: `c${v}-${b}-${c}`,
            name: ["Rina", "Budi", "Sari", "Dewi"][c],
            role: role as "pengadaan",
            channel: `kontak${c}@contoh.invalid`,
          }),
        ),
      });
    for (let n = 0; n < 30; n++) {
      const id = `i${v}-${n}`,
        buyerId = `b${v}-${n % 4}`;
      const cause =
        v === 4 && n >= 6 ? "kemungkinan_likuiditas" : causes[n % 6];
      const value = (n + 2) * 750000;
      const issued = "2026-07-01",
        due = "2026-08-15";
      const paid = n >= 24 ? "2026-09-20" : undefined;
      const docs: Doc[] = ["PO", "BAST", "Faktur pajak", "Invoice"]
        .filter((k) => !(cause === "dokumen_kurang" && k === "Faktur pajak"))
        .map((kind, k) => ({
          id: `${id}-d${k}`,
          kind,
          filename: `${kind.replaceAll(" ", "-")}.pdf`,
          uploadedBy: "vendor",
          time: issued,
          verification: "cocok",
          note: "Metadata simulasi",
          mb: 1,
          stamp: true,
          signature: true,
          poNumber: `PO-${n}`,
        }));
      db.orders.push({
        id: `o${v}-${n}`,
        vendorId,
        buyerId,
        value,
        date: issued,
        receipts: ["BAST metadata"],
      });
      db.invoices.push({
        id,
        orderId: `o${v}-${n}`,
        vendorId,
        buyerId,
        number: `INV-${v + 1}-${String(n + 1).padStart(3, "0")}`,
        issued,
        due,
        value,
        status: paid
          ? "dibayar"
          : n === 0
            ? "draft"
            : cause === "nominal_dipersoalkan"
              ? "disengketakan"
              : "tertahan",
        paid,
        docs,
        received: cause !== "penerimaan_belum_dikonfirmasi",
        dispute:
          cause === "nominal_dipersoalkan"
            ? "Selisih harga dengan kesepakatan PO"
            : "",
        approved: true,
        scheduled:
          cause === "kemungkinan_likuiditas"
            ? "2026-08-25"
            : cause === "penerimaan_belum_dikonfirmasi"
              ? "2026-11-25"
              : undefined,
        submittedAt:
          cause === "terlewat_siklus_bayar" ? "2026-10-18" : undefined,
        firstComplete: cause !== "dokumen_kurang",
        blockers: [],
        activities: [
          {
            id: `a-${id}`,
            invoiceId: id,
            kind: "telepon_dicatat",
            time: due,
            minutes: 20 + n,
            note: "Data simulasi, bukan pengukuran aktual.",
          },
        ],
        cause,
        scenario: n < 6 ? `S${n + 1}` : undefined,
      });
      db.history.push({
        id: `h-${id}`,
        vendorId,
        buyer: db.buyers.find((b) => b.id === buyerId)!.name,
        value,
        issued,
        due,
        paid,
        cause,
        minutes: 20 + n,
      });
    }
  });
  return db;
}
