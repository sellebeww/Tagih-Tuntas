import { describe, it, expect } from "vitest";
import { seed } from "../src/core/seed";
import {
  completeness,
  cycle,
  diagnose,
  transition,
  schedule,
  validateToken,
  metrics,
  audit,
  comparison,
  cadence,
} from "../src/core/engine";
import { parseCSV } from "../src/core/csv";
const setup = (n = 0) => {
  const db = seed();
  const i = db.invoices[n];
  return {
    db,
    i,
    b: db.buyers.find((b) => b.id === i.buyerId)!,
    o: db.orders[n],
  };
};
describe("Règles métier", () => {
  it("seed: 5 vendors, 20 buyers, 150 invoices", () => {
    const { db } = setup();
    expect([db.vendors.length, db.buyers.length, db.invoices.length]).toEqual([
      5, 20, 150,
    ]);
  });
  it("S1 missing tax document", () => {
    const { i, b } = setup();
    expect(completeness(i, b).missing).toContain("Faktur pajak");
  });
  it("rejects invalid format", () => {
    const { i, b } = setup(1);
    i.docs[0].filename = "bad.exe";
    expect(completeness(i, b).invalid.length).toBeGreaterThan(0);
  });
  it("S2 cutoff moves next month", () => {
    const { b } = setup();
    expect(cycle(b, "2026-10-18").payment).toBe("2026-11-25");
  });
  it("before cutoff fits current month", () => {
    const { b } = setup();
    expect(cycle(b, "2026-10-05").payment).toBe("2026-10-26");
  });
  it("S5 liquidity requires complete administration", () => {
    const { i, b, o } = setup(4);
    expect(diagnose(i, b, o, "2026-10-18").map((h) => h.category)).toEqual([
      "kemungkinan_likuiditas",
    ]);
    i.docs = [];
    expect(
      diagnose(i, b, o, "2026-10-18").some(
        (h) => h.category === "kemungkinan_likuiditas",
      ),
    ).toBe(false);
  });
  it("liquidity cannot coexist with dispute or unconfirmed receipt", () => {
    for (const key of ["received", "dispute", "approved"] as const) {
      const { i, b, o } = setup(4);
      if (key === "dispute") i.dispute = "selisih";
      else i[key] = false;
      expect(
        diagnose(i, b, o, "2026-10-18").some(
          (h) => h.category === "kemungkinan_likuiditas",
        ),
      ).toBe(false);
    }
  });
  it("S6 unknown evidence", () => {
    const { i, b, o } = setup(5);
    expect(diagnose(i, b, o, "2026-10-18")[0].category).toBe("tidak_diketahui");
  });
  it("closure requires evidence", () => {
    const { i, b, o } = setup();
    const h = diagnose(i, b, o, "2026-10-18")[0];
    const waiting = transition(h, "menunggu_pihak_lain", i, b, o, "2026-10-18");
    expect(() => transition(waiting, "selesai", i, b, o, "2026-10-18")).toThrow(
      "Bukti",
    );
    expect(() => transition(h, "selesai", i, b, o, "2026-10-18")).toThrow(
      "Transisi",
    );
  });
  it("S3 receipt evidence closes blocker", () => {
    const { i, b, o } = setup(2);
    const h = diagnose(i, b, o, "2026-10-18").find(
      (h) => h.category === "penerimaan_belum_dikonfirmasi",
    )!;
    i.received = true;
    expect(
      transition(
        { ...h, status: "menunggu_pihak_lain" },
        "selesai",
        i,
        b,
        o,
        "2026-10-18",
      ).status,
    ).toBe("selesai");
  });
  it("cannot schedule blocked invoice", () => {
    const { i, b, o } = setup();
    i.blockers = diagnose(i, b, o, "2026-10-18");
    expect(() => schedule(i, "2026-11-25")).toThrow();
  });
  it("S7 expired and wrong invoice tokens rejected", () => {
    const l = {
      id: "l",
      invoiceId: "i",
      contactId: "c",
      token: "secret",
      expires: "2026-10-10",
      action: "penerimaan" as const,
      status: "aktif" as const,
    };
    expect(() => validateToken(l, "i", "2026-10-18")).toThrow("kedaluwarsa");
    expect(() => validateToken(l, "other", "2026-10-01")).toThrow("invoice");
  });
  it("metrics resolution days", () => {
    const { i, b, o } = setup();
    i.blockers = diagnose(i, b, o, "2026-10-01")
      .slice(0, 1)
      .map((h) => ({ ...h, status: "selesai", closed: "2026-10-04" }));
    expect(metrics([i]).resolution[0].days).toBe(3);
  });
  it("audit split and S8 limited potential", () => {
    const { db } = setup();
    const a = audit(
      db.history.filter((r) => r.vendorId === "v5"),
      "2026-10-18",
    );
    expect(a.find((r) => r.name === "likuiditas")!.invoiceDays).toBeGreaterThan(
      a.find((r) => r.name === "administratif")!.invoiceDays,
    );
  });
  it("simulation never reduces liquidity or dispute", () => {
    const { db } = setup();
    const c = comparison(
      db.history.filter((r) =>
        ["kemungkinan_likuiditas", "nominal_dipersoalkan"].includes(r.cause),
      ),
      "2026-10-18",
    );
    expect(c[1].days).toBe(c[0].days);
    expect(c[2].minutes).toBe(c[0].minutes);
  });
  it("CSV quoted names and validation", () => {
    const h =
      "pelanggan,nilai,tanggal_terbit,jatuh_tempo,tanggal_bayar,penyebab\n";
    expect(
      parseCSV(
        h + '"PT A, B",1000,2026-01-01,2026-02-01,,tidak_diketahui',
        "v1",
      )[0].buyer,
    ).toBe("PT A, B");
    expect(() =>
      parseCSV(h + "A,-2,2026-01-01,2026-02-01,,tidak_diketahui", "v1"),
    ).toThrow();
  });
  it("no reminder outside finance days", () => {
    const { i, b, o } = setup();
    expect(
      cadence(i, b, diagnose(i, b, o, "2026-10-18")[0], "2026-10-18").allowed,
    ).toBe(false);
  });
});
