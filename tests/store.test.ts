import { beforeAll, afterAll, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
let store: typeof import("../src/server/store");
const directory = mkdtempSync(join(tmpdir(), "tagih-test-"));
beforeAll(async () => {
  process.env.TAGIH_DATA_FILE = join(directory, "db.json");
  store = await import("../src/server/store");
});
afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
  delete process.env.TAGIH_DATA_FILE;
});
it("S3 token scoped view, receipt closes blocker, replay rejected", () => {
  store.mutate({ action: "reset" });
  const r = store.mutate({
    action: "link",
    id: "i0-2",
    vendorId: "v1",
    buyerAction: "penerimaan",
  });
  const url = new URL(r.url!, "http://localhost");
  const token = url.pathname.split("/").pop()!;
  const view = store.buyerView(token, "i0-2");
  expect(Object.keys(view).sort()).toEqual([
    "action",
    "number",
    "required",
    "value",
  ]);
  expect(() => store.buyerView(token, "i0-3")).toThrow();
  store.buyerSubmit({ token, invoiceId: "i0-2", confirm: true });
  const i = store.read().invoices.find((i) => i.id === "i0-2")!;
  expect(i.received).toBe(true);
  expect(
    i.blockers.find((h) => h.category === "penerimaan_belum_dikonfirmasi")
      ?.status,
  ).toBe("selesai");
  expect(i.status).toBe("diterima_pembeli");
  expect(() =>
    store.buyerSubmit({ token, invoiceId: "i0-2", confirm: true }),
  ).toThrow("digunakan");
});
it("S4 buyer nominal complaint changes status and logs evidence", () => {
  const r = store.mutate({
    action: "link",
    id: "i0-5",
    vendorId: "v1",
    buyerAction: "nominal",
  });
  const token = new URL(r.url!, "http://localhost").pathname.split("/").pop()!;
  store.buyerSubmit({
    token,
    invoiceId: "i0-5",
    note: "Harga PO berbeda Rp 500.000",
  });
  const i = store.read().invoices.find((i) => i.id === "i0-5")!;
  expect(i.status).toBe("disengketakan");
  expect(i.blockers.some((h) => h.category === "nominal_dipersoalkan")).toBe(
    true,
  );
  expect(i.activities.at(-1)?.kind).toBe("konfirmasi_pembeli");
});
it("vendor mismatch cannot mutate invoice", () => {
  expect(() =>
    store.mutate({ action: "paid", id: "i0-2", vendorId: "v2" }),
  ).toThrow();
});
it("S1 upload and verification gates sending", () => {
  expect(() =>
    store.mutate({ action: "send", id: "i0-0", vendorId: "v1" }),
  ).toThrow();
  const i = store.read().invoices[0];
  store.mutate({
    action: "document",
    id: i.id,
    vendorId: "v1",
    document: {
      ...i.docs[0],
      kind: "Faktur pajak",
      filename: "tax.pdf",
      verification: "belum",
    },
  });
  expect(() =>
    store.mutate({ action: "send", id: i.id, vendorId: "v1" }),
  ).toThrow();
  store.mutate({
    action: "document",
    id: i.id,
    vendorId: "v1",
    document: {
      ...i.docs[0],
      kind: "Faktur pajak",
      filename: "tax.pdf",
      verification: "cocok",
    },
  });
  expect(() =>
    store.mutate({ action: "send", id: i.id, vendorId: "v1" }),
  ).not.toThrow();
});
