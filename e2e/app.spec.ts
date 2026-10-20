import { test, expect } from "@playwright/test";
test.beforeEach(async ({ request }) => {
  const r = await request.post("/api/data", { data: { action: "reset" } });
  expect(r.ok()).toBeTruthy();
});
test("dashboard, all navigation, filters and honest evaluation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Setiap invoice, jelas langkahnya." }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/dashboard-desktop.png",
    fullPage: false,
  });
  await page.getByLabel("Filter status").selectOption("dibayar");
  await expect(
    page.getByRole("button", { name: "INV-1-025", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "INV-1-001", exact: true }),
  ).toHaveCount(0);
  for (const menu of [
    "Antrean kerja",
    "Pelanggan",
    "Audit invoice lama",
    "Evaluasi",
    "Skenario uji",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: menu })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(menu);
  }
  await page.getByLabel("Pilih vendor").selectOption("v5");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Audit invoice lama" })
    .click();
  await expect(
    page.getByText("Sebagian besar keterlambatan adalah likuiditas.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("create invoice, duplicate prevention, and document submission gate", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "+ Invoice baru", exact: true })
    .click();
  await page.getByLabel("Nomor invoice baru").fill("INV-BROWSER-001");
  await page.getByLabel("Nilai invoice (Rp)", { exact: true }).fill("2500000");
  await page.getByRole("button", { name: "Buat draft", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "INV-BROWSER-001",
  );
  await page.getByRole("button", { name: "Periksa & tandai dikirim" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Lengkapi dan verifikasi dokumen",
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Dasbor piutang" })
    .click();
  await page
    .getByRole("button", { name: "+ Invoice baru", exact: true })
    .click();
  await page.getByLabel("Nomor invoice baru").fill("INV-BROWSER-001");
  await page.getByLabel("Nilai invoice (Rp)", { exact: true }).fill("100000");
  await page.getByRole("button", { name: "Buat draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("sudah dipakai");
});
test("buyer confirms receipt, vendor refreshes and schedules payment", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "INV-1-003", exact: true }).click();
  await page
    .getByRole("button", { name: "Minta penerimaan", exact: true })
    .click();
  const href = await page
    .getByRole("link", { name: "Buka tampilan pembeli" })
    .getAttribute("href");
  expect(href).toBeTruthy();
  const buyer = await context.newPage();
  await buyer.goto(href!);
  await buyer
    .getByLabel("Saya mengonfirmasi barang/jasa sudah diterima.")
    .check();
  await buyer.getByRole("button", { name: "Kirim jawaban" }).click();
  await expect(
    buyer.getByRole("heading", { name: "Terima kasih." }),
  ).toBeVisible();
  await page.bringToFront();
  await page.getByRole("button", { name: "Perbarui data" }).click();
  await expect(
    page.locator(".stat").filter({ hasText: "STATUS" }),
  ).toContainText("diterima pembeli");
  await page
    .getByLabel("Bukti konfirmasi jadwal dari AP")
    .fill("AP Sari mengonfirmasi tanggal 27 November");
  await page
    .getByLabel("Tanggal siklus yang telah dikonfirmasi AP")
    .fill("2026-11-27");
  await page.getByRole("button", { name: "Tandai dijadwalkan bayar" }).click();
  await expect(
    page.locator(".stat").filter({ hasText: "STATUS" }),
  ).toContainText("dijadwalkan bayar");
  await buyer.reload();
  await expect(buyer.getByRole("main").getByRole("alert")).toContainText(
    "digunakan",
  );
});
test("audit import, editable mapping and export download", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Audit invoice lama" })
    .click();
  await page.getByRole("button", { name: "Validasi & impor" }).click();
  await expect(page.getByRole("status")).toContainText("1 baris");
  await expect(
    page.getByRole("cell", { name: "PT Contoh", exact: true }),
  ).toBeVisible();
  const row = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: "PT Contoh", exact: true }),
  });
  await row.getByRole("combobox").selectOption("kemungkinan_likuiditas");
  await expect(row.getByRole("combobox")).toHaveValue("kemungkinan_likuiditas");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor CSV audit" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("audit-tagih-tuntas");
});
test("mobile layout, profile edits and expired token page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Pelanggan" })
    .click();
  await page.screenshot({
    path: "artifacts/pelanggan-mobile.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "Edit profil" }).first().click();
  await page
    .getByLabel("Catatan pengalaman")
    .fill("Verifikasi AP setiap bulan");
  await page
    .getByRole("button", { name: "Simpan profil & periksa ulang invoice" })
    .click();
  await expect(page.getByRole("status")).toContainText("tersimpan");
  await page.goto("/beli/invalid?invoice=i0-2");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "tidak berlaku",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("document correction unblocks sending and buyer dispute keeps its reason", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "INV-1-001", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Jenis dokumen", exact: true })
    .selectOption("Faktur pajak");
  await page
    .getByLabel("Nama berkas", { exact: true })
    .fill("faktur-pajak.pdf");
  await page.getByLabel("Nomor PO", { exact: true }).fill("PO-001");
  await page.getByLabel("Verifikasi vendor").selectOption("cocok");
  await page.getByLabel("Ada cap", { exact: true }).check();
  await page.getByLabel("Ada tanda tangan", { exact: true }).check();
  await page.getByRole("button", { name: "Simpan / ganti metadata" }).click();
  await expect(page.getByRole("status")).toContainText("tersimpan");
  await page.getByRole("button", { name: "Periksa & tandai dikirim" }).click();
  await expect(
    page.getByRole("button", { name: "Periksa & tandai dikirim" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Minta nominal", exact: true })
    .click();
  const href = await page
    .getByRole("link", { name: "Buka tampilan pembeli" })
    .getAttribute("href");
  const buyer = await context.newPage();
  await buyer.goto(href!);
  await buyer
    .getByLabel("Catatan (wajib)")
    .fill("Selisih dengan PO sebesar Rp 250.000");
  await buyer.getByRole("button", { name: "Kirim jawaban" }).click();
  await expect(
    buyer.getByRole("heading", { name: "Terima kasih." }),
  ).toBeVisible();
  await page.bringToFront();
  await page.getByRole("button", { name: "Perbarui data" }).click();
  await expect(
    page.locator(".stat").filter({ hasText: "STATUS" }),
  ).toContainText("disengketakan");
  await expect(
    page.getByText("Sinyal: Selisih dengan PO sebesar Rp 250.000", {
      exact: true,
    }),
  ).toBeVisible();
});
test("company profile and app link to each other", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("link", { name: "← Profil perusahaan" }).click();
  await expect(page).toHaveURL(/\/tentang$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "bayar tuntas.",
  );
  const shot = page.getByRole("img", {
    name: "Tampilan dasbor piutang TagihTuntas",
  });
  await shot.scrollIntoViewIfNeeded();
  await expect
    .poll(() => shot.evaluate((i: HTMLImageElement) => i.naturalWidth))
    .toBeGreaterThan(0);
  await page.getByRole("link", { name: "Buka aplikasi →" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Setiap invoice, jelas langkahnya." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
