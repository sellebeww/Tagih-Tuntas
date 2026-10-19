import { beforeEach, afterAll, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seed } from "../src/core/seed";
import {
  cycle,
  diagnose,
  validateToken,
  comparison,
  metrics,
} from "../src/core/engine";
import { parseCSV, exportCSV } from "../src/core/csv";
import { numberPattern, validDate } from "../src/core/validation";
import { readMutation } from "../src/server/http";
let store: typeof import("../src/server/store");
const directory = mkdtempSync(join(tmpdir(), "tagih-regression-"));
beforeEach(async () => {
  process.env.TAGIH_DATA_FILE = join(directory, "db.json");
  store = await import("../src/server/store");
  store.mutate({ action: "reset" });
});
afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
  delete process.env.TAGIH_DATA_FILE;
});
const link = (id: string, action: string) => {
  const r = store.mutate({
    action: "link",
    id,
    vendorId: "v1",
    buyerAction: action,
  });
  return new URL(r.url!, "http://localhost").pathname.split("/").pop()!;
};
it("scheduled status survives refresh and logging", () => {
  const token = link("i0-2", "penerimaan");
  store.buyerSubmit({ token, invoiceId: "i0-2", confirm: true });
  store.mutate({
    action: "schedule",
    vendorId: "v1",
    id: "i0-2",
    date: "2026-11-27",
    note: "Sari AP mengonfirmasi 27 November",
  });
  store.mutate({
    action: "log",
    vendorId: "v1",
    id: "i0-2",
    note: "Cek ulang",
    minutes: 1,
  });
  expect(store.read().invoices[2].status).toBe("dijadwalkan_bayar");
});
it("terminal invoice rejects mutation and invalidates links", () => {
  const token = link("i0-2", "nominal");
  store.mutate({ action: "paid", vendorId: "v1", id: "i0-2" });
  expect(() =>
    store.buyerSubmit({ token, invoiceId: "i0-2", note: "selisih" }),
  ).toThrow("dicabut");
  for (const action of [
    "send",
    "paid",
    "link",
    "schedule",
    "document",
    "resolveDispute",
  ])
    expect(() => store.mutate({ action, vendorId: "v1", id: "i0-2" })).toThrow(
      "lunas",
    );
});
it("reissued link revokes old capability", () => {
  const old = link("i0-2", "penerimaan");
  const fresh = link("i0-2", "penerimaan");
  expect(() => store.buyerView(old, "i0-2")).toThrow("dicabut");
  expect(store.buyerView(fresh, "i0-2").action).toBe("penerimaan");
});
it("invalid expiry is never accepted", () => {
  expect(() =>
    validateToken(
      {
        id: "x",
        invoiceId: "i",
        contactId: "c",
        token: "x",
        expires: "garbage",
        action: "alasan",
        status: "aktif",
      },
      "i",
      new Date().toISOString(),
    ),
  ).toThrow();
});
it("buyer document rejection cannot auto-close against old verification", () => {
  const token = link("i0-2", "alasan");
  store.buyerSubmit({
    token,
    invoiceId: "i0-2",
    category: "dokumen_tidak_sesuai_format",
    note: "BAST belum diberi cap penerima",
  });
  const i = store.read().invoices[2];
  const h = i.blockers.find(
    (h) => h.category === "dokumen_tidak_sesuai_format",
  )!;
  expect(h.status).toBe("terbuka");
  expect(h.source).toBe("dilaporkan_pembeli");
  expect(h.signals).toEqual(["BAST belum diberi cap penerima"]);
  expect(i.docs.every((d) => d.verification === "belum")).toBe(true);
});
it("buyer nominal report keeps provenance and exact reason", () => {
  const token = link("i0-5", "nominal");
  store.buyerSubmit({
    token,
    invoiceId: "i0-5",
    note: "Harga PO 20% lebih rendah",
  });
  const i = store.read().invoices[5];
  expect(i.status).toBe("disengketakan");
  expect(
    i.blockers.find((h) => h.category === "nominal_dipersoalkan")?.source,
  ).toBe("dilaporkan_pembeli");
});
it("liquidity inference is withdrawn if evidence changes, not counted resolved", () => {
  const i = store.read().invoices[4];
  store.mutate({
    action: "document",
    id: i.id,
    vendorId: "v1",
    document: { ...i.docs[0], verification: "belum" },
  });
  const updated = store.read().invoices[4];
  const old = updated.blockers.find(
    (h) => h.category === "kemungkinan_likuiditas",
  )!;
  expect(old.invalidated).toBeTruthy();
  expect(old.status).toBe("tidak_bisa_diselesaikan");
  expect(
    metrics([updated]).resolution.some(
      (r) => r.category === "kemungkinan_likuiditas",
    ),
  ).toBe(false);
});
it("draft invoice is created with customer terms and unique number", () => {
  const r = store.mutate({
    action: "createInvoice",
    vendorId: "v1",
    buyerId: "b0-0",
    number: "INV-NEW",
    value: 100000,
    issued: "2026-10-18",
  });
  const i = store.read().invoices.find((i) => i.id === r.id)!;
  expect(i.status).toBe("draft");
  expect(i.due).toBe("2026-11-17");
  expect(() =>
    store.mutate({
      action: "createInvoice",
      vendorId: "v1",
      buyerId: "b0-0",
      number: "inv-new",
      value: 100000,
      issued: "2026-10-18",
    }),
  ).toThrow("dipakai");
  expect(() =>
    store.mutate({ action: "paid", vendorId: "v1", id: i.id }),
  ).toThrow("Kirim");
});
it("invalid schedule date and weekend are rejected atomically", () => {
  for (const date of ["2026-11-31", "2026-11-29"])
    expect(() =>
      store.mutate({
        action: "schedule",
        vendorId: "v1",
        id: "i0-2",
        date,
        note: "AP",
      }),
    ).toThrow();
  expect(store.read().invoices[2].scheduled).toBe("2026-11-25");
});
it("failed document mutation leaves persistence unchanged", () => {
  const before = JSON.stringify(store.read());
  const i = store.read().invoices[2];
  expect(() =>
    store.mutate({
      action: "document",
      vendorId: "v1",
      id: i.id,
      minutes: -1,
      document: i.docs[0],
    }),
  ).toThrow();
  expect(JSON.stringify(store.read())).toBe(before);
});
it("malformed profile fails without persisting", () => {
  const b = store.read().buyers[0];
  expect(() =>
    store.mutate({
      action: "profile",
      vendorId: "v1",
      id: b.id,
      profile: { ...b.profile, financeDays: [9] },
      contacts: b.contacts,
    }),
  ).toThrow();
  expect(() =>
    store.mutate({
      action: "profile",
      vendorId: "v1",
      id: b.id,
      profile: { ...b.profile, numberPattern: "(a+)+$" },
      contacts: b.contacts,
    }),
  ).toThrow();
});
it("regex and date validation reject dangerous inputs", () => {
  expect(() => numberPattern("^(a+)+$")).toThrow();
  expect(validDate("2026-02-30")).toBe(false);
  expect(numberPattern("^INV-[0-9]+$").test("INV-123")).toBe(true);
});
it("cycle moves across year boundary and does not pay before cutoff", () => {
  const b = seed().buyers[0];
  expect(cycle(b, "2026-12-18").payment).toBe("2027-01-25");
  b.profile.cutoff = 20;
  b.profile.paymentDay = 5;
  expect(cycle(b, "2026-10-01").payment).toBe("2026-11-05");
});
it("overdue schedule with insufficient liquidity history remains unknown", () => {
  const db = seed(),
    i = db.invoices[4],
    b = db.buyers[0];
  b.lateRate = 0.1;
  expect(diagnose(i, b, db.orders[4], "2026-10-18")[0].category).toBe(
    "tidak_diketahui",
  );
});
it("CSV rejects duplicate headers and row-width errors", () => {
  const h = "pelanggan,nilai,tanggal_terbit,jatuh_tempo,tanggal_bayar,penyebab";
  expect(() => parseCSV(h + ",nilai\n", "v1")).toThrow("duplikat");
  expect(() => parseCSV(h + "\nA,100,2026-01-01", "v1")).toThrow("kolom");
});
it("CSV export quotes commas and neutralizes spreadsheet formulas", () => {
  const r = seed().history.slice(0, 1);
  r[0].buyer = '=HYPERLINK("x")';
  const csv = exportCSV(r);
  expect(csv).toContain("'=HYPERLINK");
  r[0].buyer = "PT A, B";
  expect(parseCSV(exportCSV(r), "v1")[0].buyer).toBe("PT A, B");
});
it("invalid vendor cannot import orphaned rows", () => {
  expect(() =>
    store.mutate({
      action: "import",
      vendorId: "missing",
      csv: exportCSV(seed().history.slice(0, 1)),
    }),
  ).toThrow("Vendor");
});
it("simulation grants no staff saving on on-time administrative invoices", () => {
  const r = seed().history.slice(0, 1);
  r[0].paid = r[0].due;
  expect(comparison(r, "2026-10-18").map((c) => c.minutes)).toEqual([
    r[0].minutes,
    r[0].minutes,
    r[0].minutes,
  ]);
});
it("HTTP guard rejects cross-origin, wrong content type, and non-object JSON", async () => {
  await expect(
    readMutation(
      new Request("http://localhost/api/data", {
        method: "POST",
        headers: {
          origin: "http://evil.invalid",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    ),
  ).rejects.toThrow("situs");
  await expect(
    readMutation(
      new Request("http://localhost/api/data", { method: "POST", body: "{}" }),
    ),
  ).rejects.toThrow("Content-Type");
  await expect(
    readMutation(
      new Request("http://localhost/api/data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "null",
      }),
    ),
  ).rejects.toThrow("objek");
});

it("same-origin browser Host works when Next normalizes request URL", async () => {
  const body = await readMutation(
    new Request("http://localhost:3100/api/data", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3100",
        origin: "http://127.0.0.1:3100",
        "content-type": "application/json",
      },
      body: '{"action":"log"}',
    }),
  );
  expect(body.action).toBe("log");
});
it("cycle diagnosis uses submission evidence, never the manual cause label", () => {
  const db = seed(),
    i = db.invoices[5],
    b = db.buyers.find((b) => b.id === i.buyerId)!;
  i.cause = "dokumen_kurang";
  expect(diagnose(i, b, db.orders[5], "2026-10-18")[0].category).toBe(
    "tidak_diketahui",
  );
  i.submittedAt = "2026-10-18";
  expect(diagnose(i, b, db.orders[5], "2026-10-18")[0].category).toBe(
    "terlewat_siklus_bayar",
  );
});
it("untrusted Host cannot access the local mutation API", async () => {
  await expect(
    readMutation(
      new Request("http://attacker.invalid/api/data", {
        method: "POST",
        headers: {
          host: "attacker.invalid",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    ),
  ).rejects.toThrow("localhost");
});
