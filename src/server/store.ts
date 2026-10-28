import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { DB, Invoice, BuyerAction, Category } from "../core/model";
import { seed } from "../core/seed";
import { config } from "../core/config";
import {
  diagnose,
  closureSatisfied,
  transition,
  schedule,
  completeness,
  cycle,
  validateToken,
  cadence,
  message,
  route,
  addDays,
} from "../core/engine";
import { parseCSV, categories } from "../core/csv";
import {
  documentMetadata,
  requiredText,
  validateProfile,
  validDate,
} from "../core/validation";
const file =
  process.env.TAGIH_DATA_FILE || path.join(process.cwd(), "data", "db.json");
const terminal = (i: Invoice) => ["dibayar", "dihapus_buku"].includes(i.status);
const active = (status: string) =>
  ["terbuka", "menunggu_pihak_lain"].includes(status);
function initialDB() {
  const db = seed();
  for (const i of db.invoices) {
    refresh(db, i);
    i.blockers.forEach((h) => (h.opened = i.due));
  }
  return db;
}
// Hosted mode (e.g. Vercel + Upstash Redis): the whole DB is one key, loaded
// into `hosted` for the synchronous store functions and written back after.
// Concurrent writers are last-write-wins.
const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const kvKey = "tagih-tuntas:db";
let hosted: DB | undefined;
async function kv(path: string, body?: string) {
  const r = await fetch(`${kvUrl}/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${kvToken}` },
    body,
    cache: "no-store",
  });
  if (!r.ok) throw Error("Penyimpanan data tidak dapat dihubungi.");
  return (await r.json()).result as string | null;
}
export async function withDB<T>(work: () => T): Promise<T> {
  if (!kvUrl || !kvToken) return work();
  const saved = await kv(`get/${kvKey}`);
  hosted = saved ? JSON.parse(saved) : initialDB();
  const result = work();
  await kv(`set/${kvKey}`, JSON.stringify(hosted));
  return result;
}
export function read(): DB {
  if (kvUrl && kvToken) return hosted!;
  if (!fs.existsSync(file)) {
    const db = initialDB();
    save(db);
    return db;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
export function save(db: DB) {
  if (kvUrl && kvToken) {
    hosted = db;
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + ".tmp";
  fs.writeFileSync(temporary, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, file);
}
export function refresh(db: DB, i: Invoice) {
  const b = db.buyers.find((b) => b.id === i.buyerId)!,
    o = db.orders.find((o) => o.id === i.orderId)!;
  // Paid documents remain an audit trail, never fabricate administrative completion.
  for (let n = 0; n < i.blockers.length; n++) {
    let h = i.blockers[n];
    if (active(h.status) && closureSatisfied(h, i, b, o)) {
      if (h.status === "terbuka")
        h = transition(h, "menunggu_pihak_lain", i, b, o, config.demoToday);
      i.blockers[n] = transition(h, "selesai", i, b, o, config.demoToday);
    }
  }
  const diagnoses = diagnose(i, b, o, config.demoToday);
  for (let n = 0; n < i.blockers.length; n++) {
    let h = i.blockers[n];
    if (
      !terminal(i) &&
      h.category === "kemungkinan_likuiditas" &&
      h.source === "aturan" &&
      active(h.status) &&
      !diagnoses.some((d) => d.category === h.category)
    ) {
      if (h.status === "terbuka")
        h = transition(h, "menunggu_pihak_lain", i, b, o, config.demoToday);
      i.blockers[n] = {
        ...transition(h, "tidak_bisa_diselesaikan", i, b, o, config.demoToday),
        invalidated:
          "Indikasi ditarik karena syarat diagnosis tidak lagi terpenuhi; bukan penyelesaian atau manfaat aplikasi.",
      };
    }
  }
  for (const h of diagnoses) {
    const existing = i.blockers.find(
      (x) => x.category === h.category && active(x.status),
    );
    if (existing) {
      if (existing.source === "aturan") existing.signals = h.signals;
      existing.deadline = h.deadline;
    } else if (
      !i.blockers.some(
        (x) =>
          x.category === h.category &&
          x.status === "selesai" &&
          closureSatisfied(x, i, b, o),
      )
    )
      i.blockers.push({ ...h, id: randomUUID() });
  }
  if (i.status !== "draft" && !terminal(i)) {
    const dispute = i.dispute || i.value !== o.value;
    i.status = dispute
      ? "disengketakan"
      : i.blockers.some((h) => h.status !== "selesai" && !h.invalidated)
        ? "tertahan"
        : i.status === "dijadwalkan_bayar" && i.scheduled
          ? "dijadwalkan_bayar"
          : "diterima_pembeli";
  }
}
function log(
  i: Invoice,
  kind: Invoice["activities"][number]["kind"],
  note: string,
  minutes = 0,
) {
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440)
    throw Error("Menit staf harus 0–1440.");
  i.activities.push({
    id: randomUUID(),
    invoiceId: i.id,
    kind,
    time: config.demoToday,
    minutes,
    note,
  });
}
function assertOpen(i: Invoice) {
  if (terminal(i))
    throw Error(
      "Invoice sudah lunas atau dihapus buku; perubahan operasional ditolak.",
    );
}
function revokeLinks(db: DB, i: Invoice) {
  db.links
    .filter((l) => l.invoiceId === i.id && l.status === "aktif")
    .forEach((l) => (l.status = "dicabut"));
}
export function mutate(input: Record<string, unknown>) {
  const db = read(),
    action = String(input.action);
  if (action === "reset") {
    save(initialDB());
    return { ok: true };
  }
  const vendorId = requiredText(input.vendorId, "Vendor", 100);
  if (!db.vendors.some((v) => v.id === vendorId))
    throw Error("Vendor tidak ditemukan.");
  if (action === "import") {
    const rows = parseCSV(requiredText(input.csv, "CSV", 1_000_000), vendorId);
    if (!rows.length) throw Error("CSV tidak memiliki baris data.");
    db.history.push(...rows.map((r) => ({ ...r, id: randomUUID() })));
    save(db);
    return { count: rows.length };
  }
  if (action === "mapCause") {
    if (!categories.includes(input.cause as Category))
      throw Error("Penyebab tidak valid.");
    const r = db.history.find(
      (r) => r.id === input.id && r.vendorId === vendorId,
    );
    if (!r) throw Error("Baris tidak ditemukan.");
    r.cause = input.cause as Category;
    save(db);
    return { ok: true };
  }
  if (action === "profile") {
    const b = db.buyers.find(
      (b) => b.id === input.id && b.vendorId === vendorId,
    );
    if (!b) throw Error("Pelanggan tidak ditemukan.");
    const clean = validateProfile(input.profile, input.contacts);
    b.profile = clean.profile;
    b.contacts = clean.contacts;
    db.invoices
      .filter((i) => i.buyerId === b.id && !terminal(i))
      .forEach((i) => refresh(db, i));
    save(db);
    return { ok: true };
  }
  if (action === "createInvoice") {
    const b = db.buyers.find(
      (b) => b.id === input.buyerId && b.vendorId === vendorId,
    );
    if (!b) throw Error("Pelanggan tidak ditemukan.");
    const number = requiredText(input.number, "Nomor invoice", 100),
      value = Number(input.value),
      issued = input.issued;
    if (
      !validDate(issued) ||
      issued > config.demoToday ||
      !Number.isSafeInteger(value) ||
      value <= 0
    )
      throw Error(
        "Tanggal terbit/nilai Rupiah tidak valid; tanggal tidak boleh setelah tanggal demo.",
      );
    const due = input.due || addDays(issued, b.terms);
    if (!validDate(due) || due < issued)
      throw Error("Jatuh tempo tidak valid.");
    if (
      db.invoices.some(
        (i) =>
          i.vendorId === vendorId &&
          i.number.toLowerCase() === number.toLowerCase(),
      )
    )
      throw Error("Nomor invoice sudah dipakai vendor ini.");
    const id = randomUUID(),
      orderId = randomUUID();
    db.orders.push({
      id: orderId,
      vendorId,
      buyerId: b.id,
      value,
      date: issued,
      receipts: [],
    });
    const i: Invoice = {
      id,
      orderId,
      vendorId,
      buyerId: b.id,
      number,
      value,
      issued,
      due,
      status: "draft",
      docs: [],
      received: false,
      dispute: "",
      approved: false,
      blockers: [],
      activities: [],
      cause: "tidak_diketahui",
    };
    db.invoices.push(i);
    refresh(db, i);
    save(db);
    return { id, ok: true };
  }
  const i = db.invoices.find(
    (i) => i.id === input.id && i.vendorId === vendorId,
  );
  if (!i) throw Error("Invoice tidak ditemukan untuk vendor ini.");
  const b = db.buyers.find((b) => b.id === i.buyerId)!;
  if (action === "revokeLink") {
    const l = db.links.find(
      (l) => l.id === input.linkId && l.invoiceId === i.id,
    );
    if (!l || l.status !== "aktif")
      throw Error("Tautan aktif tidak ditemukan.");
    l.status = "dicabut";
    save(db);
    return { ok: true };
  }
  if (action !== "log") assertOpen(i);
  if (action === "document") {
    const d = documentMetadata(input.document, b.profile.required);
    i.docs = i.docs.filter((x) => x.kind !== d.kind);
    i.docs.push({
      ...d,
      id: randomUUID(),
      uploadedBy: "vendor",
      time: config.demoToday,
    });
    log(i, "dokumen_diunggah", d.kind, Number(input.minutes || 0));
  } else if (action === "send") {
    if (i.status !== "draft")
      throw Error("Hanya invoice draft yang dapat dikirim.");
    if (!completeness(i, b).complete)
      throw Error("Lengkapi dan verifikasi dokumen sebelum pengiriman.");
    i.firstComplete = true;
    i.status = "dikirim";
    i.submittedAt = config.demoToday;
    log(
      i,
      "pesan_disusun",
      "Invoice dikirim secara manual",
      Number(input.minutes || 0),
    );
  } else if (action === "link") {
    const requested = String(input.buyerAction) as BuyerAction;
    if (!["penerimaan", "dokumen", "alasan", "nominal"].includes(requested))
      throw Error("Aksi tautan tidak valid.");
    const role =
      requested === "penerimaan"
        ? "penerima_barang"
        : requested === "nominal"
          ? "pengadaan"
          : "keuangan_ap";
    const contact = b.contacts.find((c) => c.role === role);
    if (!contact) throw Error("Tambahkan kontak yang sesuai terlebih dahulu.");
    const token = randomBytes(32).toString("hex");
    db.links
      .filter(
        (l) =>
          l.invoiceId === i.id &&
          l.action === requested &&
          l.status === "aktif",
      )
      .forEach((l) => (l.status = "dicabut"));
    db.links.push({
      id: randomUUID(),
      invoiceId: i.id,
      contactId: contact.id,
      token,
      action: requested,
      expires: new Date(Date.now() + config.tokenHours * 3600000).toISOString(),
      status: "aktif",
    });
    save(db);
    return { url: `/beli/${token}?invoice=${i.id}` };
  } else if (action === "log")
    log(
      i,
      "telepon_dicatat",
      requiredText(input.note, "Catatan"),
      Number(input.minutes),
    );
  else if (action === "message" || action === "escalate") {
    const h = i.blockers.find(
      (h) => h.id === input.blockerId && active(h.status),
    );
    if (!h) throw Error("Hambatan aktif tidak ditemukan.");
    const c = cadence(i, b, h, config.demoToday);
    if (!c.allowed)
      throw Error("Di luar hari kerja AP atau jeda pengingat belum terpenuhi.");
    if (action === "escalate") {
      if (!c.escalate || !b.contacts.some((c) => c.role === "atasan"))
        throw Error(
          "Belum memenuhi umur eskalasi atau kontak atasan belum ada.",
        );
      h.owner = "atasan";
      log(i, "eskalasi", "Dialihkan kepada atasan", Number(input.minutes || 0));
    } else
      log(
        i,
        "pesan_disusun",
        message(i, b, h, config.demoToday),
        Number(input.minutes || 0),
      );
  } else if (action === "waiting") {
    const h = i.blockers.find((h) => h.id === input.blockerId);
    if (!h) throw Error("Hambatan tidak ditemukan.");
    Object.assign(
      h,
      transition(
        h,
        "menunggu_pihak_lain",
        i,
        b,
        db.orders.find((o) => o.id === i.orderId)!,
        config.demoToday,
      ),
    );
  } else if (action === "schedule") {
    const date = input.date;
    if (
      !validDate(date) ||
      date < cycle(b, config.demoToday, i.due).payment ||
      !b.profile.financeDays.includes(new Date(date).getUTCDay())
    )
      throw Error(
        "Tanggal tidak valid, bukan hari kerja AP, atau lebih awal dari siklus realistis.",
      );
    if (i.status === "draft")
      throw Error("Kirim invoice sebelum menjadwalkan pembayaran.");
    const note = requiredText(input.note, "Bukti konfirmasi AP");
    const copy = structuredClone(i);
    copy.scheduled = date;
    refresh(db, copy);
    Object.assign(i, schedule(copy, date));
    log(
      i,
      "telepon_dicatat",
      `Jadwal bayar ${date}, konfirmasi AP: ${note}`,
      Number(input.minutes || 0),
    );
  } else if (action === "resolveDispute") {
    const note = requiredText(input.note, "Kesepakatan nominal"),
      value = Number(input.value);
    if (!Number.isSafeInteger(value) || value <= 0)
      throw Error("Nilai Rupiah harus bilangan bulat positif.");
    const o = db.orders.find((o) => o.id === i.orderId)!;
    if (!i.dispute && i.value === o.value)
      throw Error("Tidak ada sengketa nominal aktif.");
    const old = `invoice ${i.value}, PO ${o.value}`;
    i.value = value;
    o.value = value;
    i.dispute = "";
    log(
      i,
      "telepon_dicatat",
      `Kesepakatan nominal (${old} → ${value}): ${note}`,
      Number(input.minutes || 0),
    );
  } else if (action === "approve") {
    if (i.approved) throw Error("Persetujuan sudah tercatat.");
    i.approved = true;
    log(
      i,
      "telepon_dicatat",
      "Persetujuan internal: " + requiredText(input.note, "Bukti persetujuan"),
      Number(input.minutes || 0),
    );
  } else if (action === "paid") {
    if (i.status === "draft")
      throw Error("Kirim invoice sebelum mencatat pelunasan.");
    i.status = "dibayar";
    i.paid = config.demoToday;
    revokeLinks(db, i);
    log(
      i,
      "telepon_dicatat",
      "Pelunasan dicatat manual; bukan integrasi bank",
      Number(input.minutes || 0),
    );
  } else throw Error("Aksi tidak dikenal.");
  refresh(db, i);
  save(db);
  return { ok: true };
}
export function buyerView(token: string, invoiceId: string) {
  const db = read();
  const l = validateToken(
    db.links.find((l) => l.token === token),
    invoiceId,
    new Date().toISOString(),
  );
  const i = db.invoices.find((i) => i.id === l.invoiceId)!;
  assertOpen(i);
  return {
    number: i.number,
    value: i.value,
    action: l.action,
    required: db.buyers.find((b) => b.id === i.buyerId)!.profile.required,
  };
}
export function buyerSubmit(input: Record<string, unknown>) {
  const db = read();
  const l = validateToken(
    db.links.find((l) => l.token === input.token),
    String(input.invoiceId),
    new Date().toISOString(),
  );
  const i = db.invoices.find((i) => i.id === l.invoiceId)!;
  assertOpen(i);
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 2000) throw Error("Catatan maksimum 2000 karakter.");
  let reported: Category | undefined;
  if (l.action === "penerimaan") {
    if (input.confirm !== true)
      throw Error("Konfirmasi penerimaan diperlukan.");
    i.received = true;
  }
  if (l.action === "nominal") {
    requiredText(note, "Alasan selisih nominal");
    i.dispute = note;
    i.cause = "nominal_dipersoalkan";
    reported = i.cause;
  }
  if (l.action === "alasan") {
    const category = input.category as Category;
    if (!categories.includes(category)) throw Error("Pilih alasan yang valid.");
    requiredText(note, "Catatan alasan");
    i.cause = category;
    reported = category;
    if (category === "nominal_dipersoalkan") i.dispute = note;
    if (category === "penerimaan_belum_dikonfirmasi") i.received = false;
    if (category === "menunggu_persetujuan_internal") i.approved = false;
    // A buyer rejection invalidates old verification. Require fresh vendor review.
    if (["dokumen_kurang", "dokumen_tidak_sesuai_format"].includes(category))
      i.docs.forEach((d) => {
        d.verification = "belum";
        d.note = `Perlu pemeriksaan ulang: ${note}`;
      });
    if (category === "terlewat_siklus_bayar") i.scheduled = undefined;
  }
  if (l.action === "dokumen") {
    const b = db.buyers.find((b) => b.id === i.buyerId)!;
    const d = documentMetadata(
      {
        kind: input.kind,
        filename: input.filename,
        mb: input.mb,
        verification: "belum",
        note,
        stamp: false,
        signature: false,
        poNumber: "",
      },
      b.profile.required,
    );
    i.docs = i.docs.filter((d0) => d0.kind !== d.kind);
    i.docs.push({
      ...d,
      id: randomUUID(),
      uploadedBy: l.contactId,
      time: config.demoToday,
    });
  }
  if (reported) {
    const existing = i.blockers.find(
      (h) => h.category === reported && active(h.status),
    );
    const report = {
      category: reported,
      source: "dilaporkan_pembeli" as const,
      confidence:
        reported === "kemungkinan_likuiditas" || reported === "tidak_diketahui"
          ? ("sedang" as const)
          : ("tinggi" as const),
      owner: route[reported].owner,
      nextAction: route[reported].action,
      signals: [note],
    };
    if (existing) Object.assign(existing, report);
    else
      i.blockers.push({
        ...report,
        id: randomUUID(),
        invoiceId: i.id,
        deadline: cycle(
          db.buyers.find((b) => b.id === i.buyerId)!,
          config.demoToday,
          i.due,
        ).cutoff,
        status: "terbuka",
        opened: config.demoToday,
      });
  }
  l.status = "digunakan";
  log(
    i,
    "konfirmasi_pembeli",
    `${l.action}: ${note || "Penerimaan dikonfirmasi"}`,
  );
  refresh(db, i);
  save(db);
  return { ok: true };
}
