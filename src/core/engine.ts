import {
  Buyer,
  Invoice,
  Order,
  Blocker,
  Category,
  Role,
  Historical,
  BuyerLink,
} from "./model";
import { config } from "./config";
import { numberPattern, validDate } from "./validation";
export const days = (a: string, b: string) =>
  Math.max(0, Math.floor((Date.parse(b) - Date.parse(a)) / 86400000));
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) =>
  iso(new Date(Date.parse(s) + n * 86400000));
export const labels: Record<Category, string> = {
  dokumen_kurang: "Dokumen kurang",
  dokumen_tidak_sesuai_format: "Format dokumen",
  penerimaan_belum_dikonfirmasi: "Penerimaan belum dikonfirmasi",
  nominal_dipersoalkan: "Sengketa nominal",
  menunggu_persetujuan_internal: "Persetujuan internal",
  terlewat_siklus_bayar: "Terlewat siklus bayar",
  kemungkinan_likuiditas: "Indikasi likuiditas",
  tidak_diketahui: "Tidak diketahui",
};
export function completeness(i: Invoice, b: Buyer) {
  const p = b.profile;
  const missing = p.required.filter((k) => !i.docs.some((d) => d.kind === k));
  const invalid: string[] = [];
  const pattern = numberPattern(p.numberPattern);
  if (!pattern.test(i.number)) invalid.push("Nomor invoice tidak sesuai pola");
  for (const k of p.required) {
    const docs = i.docs.filter((d) => d.kind === k);
    if (
      docs.length &&
      !docs.some(
        (d) =>
          d.verification === "cocok" &&
          Number.isFinite(d.mb) &&
          d.mb > 0 &&
          d.mb <= p.maxMB &&
          p.extensions.includes(
            d.filename.split(".").pop()?.toLowerCase() ?? "",
          ) &&
          (!p.stamp || d.stamp) &&
          (!p.signature || d.signature) &&
          (!p.requirePO || !!d.poNumber?.trim()),
      )
    )
      invalid.push(
        `${k}: verifikasi, format, ukuran, PO, cap, atau tanda tangan belum sesuai`,
      );
  }
  return { missing, invalid, complete: !missing.length && !invalid.length };
}
function monthly(year: number, month: number, day: number) {
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()),
    ),
  );
}
export function cycle(b: Buyer, today: string, due = today) {
  const p = b.profile;
  if (!validDate(today) || !validDate(due))
    throw Error("Tanggal siklus tidak valid.");
  if (
    ![p.cutoff, p.paymentDay].every(
      (d) => Number.isInteger(d) && d >= 1 && d <= 31,
    ) ||
    ![p.exchangeDays, p.financeDays].every(
      (a) =>
        a.length > 0 && a.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    )
  )
    throw Error("Hari kerja wajib dipilih.");
  let submit = new Date(today + "T00:00:00Z");
  for (let n = 0; n < 7 && !p.exchangeDays.includes(submit.getUTCDay()); n++)
    submit.setUTCDate(submit.getUTCDate() + 1);
  const missed = submit.getUTCDate() > p.cutoff;
  let month = submit.getUTCMonth() + (missed ? 1 : 0);
  const year = submit.getUTCFullYear();
  const cutoff = monthly(year, month, p.cutoff);
  let pay = monthly(year, month, p.paymentDay);
  for (
    let n = 0;
    n < 1200 &&
    (iso(pay) < iso(submit) || iso(pay) < due || iso(pay) < iso(cutoff));
    n++
  )
    pay = monthly(year, ++month, p.paymentDay);
  if (iso(pay) < due) throw Error("Jatuh tempo terlalu jauh.");
  while (!p.financeDays.includes(pay.getUTCDay()))
    pay.setUTCDate(pay.getUTCDate() + 1);
  return {
    missed,
    submission: iso(submit),
    cutoff: iso(
      monthly(year, submit.getUTCMonth() + (missed ? 1 : 0), p.cutoff),
    ),
    payment: iso(pay),
  };
}
export const route: Record<Category, { owner: Role; action: string }> = {
  dokumen_kurang: {
    owner: "vendor",
    action: "Lengkapi dan verifikasi dokumen wajib",
  },
  dokumen_tidak_sesuai_format: {
    owner: "vendor",
    action: "Perbaiki metadata dan format dokumen",
  },
  penerimaan_belum_dikonfirmasi: {
    owner: "penerima_barang",
    action: "Konfirmasi penerimaan melalui tautan",
  },
  nominal_dipersoalkan: {
    owner: "pengadaan",
    action: "Rekonsiliasi nilai PO dan invoice; catat kesepakatan",
  },
  menunggu_persetujuan_internal: {
    owner: "atasan",
    action: "Minta persetujuan internal",
  },
  terlewat_siklus_bayar: {
    owner: "keuangan_ap",
    action: "Konfirmasi pendaftaran pada siklus berikutnya",
  },
  kemungkinan_likuiditas: {
    owner: "atasan",
    action: "Diskusikan kemampuan bayar; pertimbangkan jeda pesanan",
  },
  tidak_diketahui: {
    owner: "keuangan_ap",
    action: "Tanyakan alasan tertahan kepada AP melalui tautan",
  },
};
export function diagnose(
  i: Invoice,
  b: Buyer,
  o: Order,
  today: string,
): Blocker[] {
  if (["dibayar", "dihapus_buku"].includes(i.status)) return [];
  const check = completeness(i, b),
    c = cycle(b, today, i.due);
  const submission =
    i.submittedAt || (i.status === "draft" ? today : undefined);
  const missedSubmission = submission ? cycle(b, submission, i.due) : undefined;
  const found: Blocker[] = [];
  const push = (
    category: Category,
    signals: string[],
    confidence: Blocker["confidence"] = "tinggi",
  ) =>
    found.push({
      id: `${i.id}-${category}`,
      invoiceId: i.id,
      category,
      signals,
      confidence,
      source: "aturan",
      owner: route[category].owner,
      nextAction: route[category].action,
      deadline: c.cutoff,
      status: "terbuka",
      opened: today,
    });
  if (check.missing.length) push("dokumen_kurang", check.missing);
  if (check.invalid.length) push("dokumen_tidak_sesuai_format", check.invalid);
  if (i.dispute || i.value !== o.value)
    push("nominal_dipersoalkan", [
      i.dispute || "Nilai invoice berbeda dari PO",
    ]);
  if (!i.received && i.docs.some((d) => d.kind === "BAST"))
    push("penerimaan_belum_dikonfirmasi", [
      "BAST tersedia, penerima belum mengonfirmasi",
    ]);
  if (!i.approved)
    push("menunggu_persetujuan_internal", [
      "Persetujuan internal belum dicatat",
    ]);
  const liquid =
    check.complete &&
    i.received &&
    !i.dispute &&
    i.value === o.value &&
    i.approved &&
    !!i.scheduled &&
    i.scheduled < today &&
    i.due < today &&
    b.lateRate >= config.slowCustomerRate;
  if (liquid)
    push(
      "kemungkinan_likuiditas",
      [
        "Administrasi lengkap dan penerimaan terkonfirmasi",
        "Tidak ada sengketa / persetujuan tertunda",
        `Jadwal ${i.scheduled} terlewati; pola terlambat ${Math.round(b.lateRate * 100)}% (asumsi)`,
      ],
      "sedang",
    );
  else if (missedSubmission?.missed && !i.scheduled)
    push("terlewat_siklus_bayar", [
      `Penyerahan ${missedSubmission.submission} melewati cut-off; paling cepat ${c.payment}`,
    ]);
  if (!found.length && (!i.scheduled || i.scheduled < today))
    push("tidak_diketahui", ["Bukti belum cukup; perlu jawaban AP"], "rendah");
  return found;
}
export function closureSatisfied(
  h: Blocker,
  i: Invoice,
  b: Buyer,
  o: Order,
  today = config.demoToday,
) {
  const c = completeness(i, b);
  switch (h.category) {
    case "dokumen_kurang":
    case "dokumen_tidak_sesuai_format":
      return c.complete;
    case "penerimaan_belum_dikonfirmasi":
      return i.received;
    case "nominal_dipersoalkan":
      return !i.dispute && i.value === o.value;
    case "menunggu_persetujuan_internal":
      return i.approved;
    case "terlewat_siklus_bayar":
      return !!i.scheduled && i.scheduled >= today;
    case "kemungkinan_likuiditas":
      return i.status === "dibayar";
    default:
      return (
        i.status === "dibayar" ||
        (i.cause !== "tidak_diketahui" &&
          i.blockers.some(
            (other) =>
              other.id !== h.id &&
              other.category === i.cause &&
              other.source === "dilaporkan_pembeli",
          ))
      );
  }
}
export function transition(
  h: Blocker,
  next: Blocker["status"],
  i: Invoice,
  b: Buyer,
  o: Order,
  today: string,
): Blocker {
  const allowed: Record<Blocker["status"], Blocker["status"][]> = {
    terbuka: ["menunggu_pihak_lain"],
    menunggu_pihak_lain: ["selesai", "tidak_bisa_diselesaikan"],
    selesai: [],
    tidak_bisa_diselesaikan: [],
  };
  if (!allowed[h.status].includes(next))
    throw Error(`Transisi ${h.status} → ${next} tidak sah.`);
  if (next === "selesai" && !closureSatisfied(h, i, b, o, today))
    throw Error("Bukti penutup hambatan belum terpenuhi.");
  return {
    ...h,
    status: next,
    closed: ["selesai", "tidak_bisa_diselesaikan"].includes(next)
      ? today
      : undefined,
  };
}
export const actionable = (h: Blocker) =>
  !h.invalidated && ["terbuka", "menunggu_pihak_lain"].includes(h.status);
export function schedule(i: Invoice, date: string): Invoice {
  if (!validDate(date)) throw Error("Tanggal pembayaran tidak valid.");
  if (["dibayar", "dihapus_buku", "draft"].includes(i.status))
    throw Error("Status invoice tidak mengizinkan penjadwalan.");
  if (i.blockers.some((h) => h.status !== "selesai" && !h.invalidated))
    throw Error(
      "Semua hambatan harus selesai sebelum invoice dijadwalkan bayar.",
    );
  return { ...i, status: "dijadwalkan_bayar", scheduled: date };
}
export function validateToken(
  l: BuyerLink | undefined,
  invoiceId: string,
  now: string,
) {
  if (!l || l.invoiceId !== invoiceId)
    throw Error("Tautan tidak berlaku untuk invoice ini.");
  if (
    !Number.isFinite(Date.parse(l.expires)) ||
    !Number.isFinite(Date.parse(now)) ||
    Date.parse(l.expires) <= Date.parse(now)
  )
    throw Error("Tautan sudah kedaluwarsa.");
  if (l.status === "dicabut")
    throw Error("Tautan sudah dicabut. Minta tautan baru kepada vendor.");
  if (l.status !== "aktif") throw Error("Tautan sudah digunakan.");
  return l;
}
export function cadence(i: Invoice, b: Buyer, h: Blocker, today: string) {
  const last = i.activities
    .filter((a) => ["pesan_disusun", "eskalasi"].includes(a.kind))
    .at(-1);
  return {
    allowed:
      b.profile.financeDays.includes(new Date(today).getUTCDay()) &&
      (!last || days(last.time, today) >= config.reminderGapDays),
    escalate:
      ["terbuka", "menunggu_pihak_lain"].includes(h.status) &&
      days(h.opened, today) >= config.escalationDays,
  };
}
export function message(i: Invoice, b: Buyer, h: Blocker, today: string) {
  const c = cycle(b, today, i.due);
  return `Yth. ${b.contacts.find((x) => x.role === h.owner)?.name ?? b.name}, terkait ${i.number}: ${labels[h.category]}. ${h.signals.join("; ")}. Mohon ${h.nextAction.toLowerCase()}. Cut-off berikutnya ${c.cutoff}, estimasi pembayaran paling cepat ${c.payment} (perlu konfirmasi AP). Terima kasih.`;
}
export function group(c: Category) {
  return c === "kemungkinan_likuiditas"
    ? "likuiditas"
    : c === "nominal_dipersoalkan"
      ? "sengketa"
      : c === "tidak_diketahui"
        ? "tidak_diketahui"
        : "administratif";
}
export function audit(rows: Historical[], today: string) {
  return (
    ["administratif", "sengketa", "likuiditas", "tidak_diketahui"] as const
  ).map((name) => {
    const items = rows.filter(
      (r) => group(r.cause) === name && days(r.due, r.paid || today) > 0,
    );
    return {
      name,
      count: items.length,
      value: items.reduce((s, r) => s + r.value, 0),
      invoiceDays: items.reduce((s, r) => s + days(r.due, r.paid || today), 0),
      minutes: items.reduce((s, r) => s + r.minutes, 0),
    };
  });
}
export function comparison(rows: Historical[], today: string) {
  return [
    { name: "Proses sekarang", reduction: 0, staff: 0 },
    {
      name: "Cek sebelum kirim",
      reduction: config.completenessReduction,
      staff: config.staffReductionCheck,
    },
    {
      name: "Cek + perutean + tautan",
      reduction: config.routingReduction,
      staff: config.staffReductionRoute,
    },
  ].map((mode) => ({
    name: mode.name,
    days: rows.reduce(
      (s, r) =>
        s +
        days(r.due, r.paid || today) *
          (1 - (group(r.cause) === "administratif" ? mode.reduction : 0)),
      0,
    ),
    minutes: rows.reduce(
      (s, r) =>
        s +
        r.minutes *
          (1 -
            (group(r.cause) === "administratif" &&
            days(r.due, r.paid || today) > 0
              ? mode.staff
              : 0)),
      0,
    ),
    value: rows.reduce(
      (s, r) => s + (days(r.due, r.paid || today) > 0 ? r.value : 0),
      0,
    ),
  }));
}
export function metrics(invoices: Invoice[]) {
  const hs = invoices
    .flatMap((i) => i.blockers)
    .filter((h) => h.status === "selesai" && h.closed);
  return {
    resolution: hs.map((h) => ({
      category: h.category,
      days: days(h.opened, h.closed!),
    })),
    paid: invoices
      .filter((i) => i.paid)
      .map((i) => ({ id: i.id, days: days(i.issued, i.paid!) })),
    minutes: invoices.map((i) => ({
      id: i.id,
      minutes: i.activities.reduce((s, a) => s + a.minutes, 0),
    })),
    firstComplete: invoices.filter(
      (i) => i.status !== "draft" && i.firstComplete !== undefined,
    ).length
      ? invoices.filter((i) => i.status !== "draft" && i.firstComplete).length /
        invoices.filter(
          (i) => i.status !== "draft" && i.firstComplete !== undefined,
        ).length
      : 0,
  };
}
