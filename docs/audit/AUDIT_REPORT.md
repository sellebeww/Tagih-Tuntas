# Laporan Audit TagihTuntas — 19 Oktober 2026

Branch kerja `chore/audit-20261019` (baseline `9f40c36` di `main`). Dokumen pendukung: [THREAT_MODEL](THREAT_MODEL.md) · [DECISIONS](DECISIONS.md) · [MANUAL_ACTIONS](MANUAL_ACTIONS.md) · [ROLLBACK](ROLLBACK.md) · [PROGRESS](PROGRESS.md).

## 1. Ringkasan eksekutif

Proyek sudah dalam kondisi baik sebelum audit: validasi server, guard CSRF/DNS rebinding, token pembeli kuat, 43 tes unit + 6 tes browser hijau, `npm audit` 0. Audit menemukan dan memperbaiki **1 kerentanan Sedang** (ReDoS persisten lewat pola nomor invoice), **3 penguatan Rendah** (CSP + Permissions-Policy, header `X-Powered-By`, `noindex`), dan **6 masalah aksesibilitas** (kontras teks, kontras cincin fokus, `aria-current`, ikon dekoratif terbaca pembaca layar, tidak ada skip link, target sentuh 14px). **0 file dihapus**, tidak ada aset yang perlu dipindah, ukuran bundle JS tetap 1.012 KB. Semua verifikasi diulang dari clone bersih dan lulus.

## 2. File dan folder yang dihapus

Tidak ada. Diperiksa: berkas yang di-track Git (`git ls-files`) tidak berisi `.log/.tmp/.bak/.orig/.DS_Store`; artefak build/cache (`.next`, `tsconfig.tsbuildinfo`, `test-results`, `data/`) sudah diabaikan `.gitignore` dan tidak ter-commit. `tsc --noUnusedLocals --noUnusedParameters` hanya menemukan satu import tak terpakai (`Category` di `src/app/page.tsx`), sudah dihapus.

## 3. Aset visual

| Aset | Pemakaian | Aksi |
| --- | --- | --- |
| `artifacts/dashboard-desktop.png`, `artifacts/pelanggan-mobile.png` | Ditulis oleh `e2e/app.spec.ts:16,159`, dirujuk README/AUDIT.md | Diperbarui otomatis oleh e2e (UI terkini); nama sudah deskriptif |

Tidak ada gambar, ikon berkas, atau font aplikasi (font sistem Arial, ikon berupa karakter Unicode). Hash MD5 berbeda, tidak ada duplikat. Fase 3 tidak memerlukan perubahan.

## 4. Struktur direktori

Tidak diubah; struktur sudah sesuai konvensi Next App Router dan rapi:

```
src/app/      route UI + API (page.tsx, beli/[token], api/data, api/buyer)
src/core/     logika murni (engine, model, csv, validation, seed, config)
src/server/   I/O server (store JSON, guard HTTP)
tests/ e2e/   Vitest dan Playwright
docs/audit/   dokumen audit ini (baru)
```

## 5. Standar penamaan

Sudah konsisten: komponen `PascalCase` (`Home`, `BuyerPage`, `Layout`), fungsi/variabel `camelCase`, berkas non-komponen kebab/lowercase, alias `@/` sinkron di TS. Tidak ada rename.

## 6. Kode dan dependensi

- Import tak terpakai `Category` dihapus (`src/app/page.tsx`).
- Dependensi: tidak ada yang dihapus/diperbarui. Semua dipakai; satu-satunya pembaruan tersedia adalah mayor (TypeScript 7, `@types/node` 26) → keputusan manual (D7). Tailwind hanya menyumbang preflight → keputusan manual (D6).
- `.gitignore` ditambah `.DS_Store`, `*.log`. README kini menjelaskan `TAGIH_DATA_FILE`.

## 7. Temuan keamanan

| Keparahan | Lokasi | Temuan | Status |
| --- | --- | --- | --- |
| Sedang | `src/core/validation.ts:24` | Pola nomor invoice hanya membatasi `+`/`*`. Kuantifier `{m,n}` dan `?` lolos. Bukti: `^a{0,30}…$` ×7 terhadap 60 karakter = **22,4 detik** (×5 = 0,17 dtk, ×6 = 2,1 dtk). Pola disimpan di profil lalu dievaluasi pada setiap `refresh`/`completeness` → proses Node satu-satunya macet berulang sampai `db.json` diedit tangan. | **Diperbaiki** [TERVERIFIKASI]: kuantifier yang bisa backtrack (`+ * ?` dan rentang `{m,}`/`{m,n}`) dihitung bersama, maks. 2; jumlah tetap `{n}` dan literal escape (`\+`, `\{`) tidak dihitung, sehingga format seperti `^\d{3}/INV/\d{2}/\d{4}$` tetap valid. Kasus terburuk 2 kuantifier pada 100 karakter terukur < 2 ms. Profil lama yang polanya kini ditolak tidak membuat aplikasi crash: `completeness` menandainya "pola perlu diperbarui" tanpa menjalankan regex. Tes regresi di `tests/regression.test.ts`. Data lokal hanya memakai `^INV-`. |
| Rendah | `next.config.ts` | Tidak ada `Content-Security-Policy` dan `Permissions-Policy`. | **Diperbaiki** [TERVERIFIKASI]: header ada di respons; tidak ada pelanggaran CSP di konsol pada build produksi maupun `next dev`. |
| Rendah | `next.config.ts` | Header `X-Powered-By: Next.js` terekspos. | **Diperbaiki** [TERVERIFIKASI]: header tidak ada lagi. |
| Rendah | `src/app/layout.tsx` | Halaman tautan pembeli tidak ditandai `noindex`. | **Diperbaiki**: `robots: { index: false, follow: false }`. |
| Info | `src/server/http.ts:67` | `failure()` meneruskan `e.message` mentah; error sistem berkas bisa menampilkan path lokal. | Tidak diubah: hanya terlihat di loopback oleh operator sendiri. |
| Info | `src/server/store.ts:429` | Pencarian token memakai `===` (bukan constant-time). | Tidak diubah: token acak 256-bit, akses lokal; serangan timing tidak praktis. |
| Info | Desain | Tanpa autentikasi vendor; aksi `reset` tidak terikat vendor. | Batas MVP yang sudah didokumentasikan → [MANUAL_ACTIONS](MANUAL_ACTIONS.md) #2 sebelum data nyata/deploy. |
| Info | Repo | Pemindaian secret (pola API key/token/private key/connection string/webhook) di seluruh berkas kerja. | Tidak ditemukan; satu-satunya hasil adalah fixture tes `"secret"` (`tests/core.test.ts:116`). Riwayat Git tidak relevan (repo baru dibuat). Tidak ada `.env`. |
| Info | Dependensi | `npm audit` | 0 kerentanan (baseline dan clone bersih). Lockfile ter-commit; tidak ada rentang `*`/`latest`. |
| Info | Repo | Pencarian teks instruksi tertanam (prompt injection) | Tidak ditemukan. |

Sudah benar sejak awal (diperiksa, tidak diubah): guard Origin/`Sec-Fetch-Site`/Content-Type dan batas body 1,1 MB, allowlist Host loopback, token `randomBytes(32)` sekali pakai + kedaluwarsa + dicabut saat lunas, token disamarkan di `GET /api/data`, ekspor CSV menetralkan formula, tidak ada `dangerouslySetInnerHTML`/`eval`, tulis berkas atomik mode 0600.

## 8. UI/UX dan aksesibilitas

| Masalah | Sebelum | Sesudah |
| --- | --- | --- |
| Kontras teks `--muted` (dipakai pada teks 10–12px) | 3,73:1 di latar paper, 3,83:1 di header tabel | 4,83:1 / 4,95:1 (`#5e706a`) |
| Kontras cincin fokus di latar terang | 1,75:1, hanya untuk `button`/`a` | 6,64:1 untuk semua elemen fokus; cincin terang dipertahankan di sidebar/notifikasi (6,2–6,5:1) |
| Menu aktif | Hanya dibedakan warna | `aria-current="page"` |
| Ikon menu/brand Unicode | Dibacakan pembaca layar | `aria-hidden` |
| Skip link | Tidak ada | "Lewati ke konten utama" (Tab pertama → Enter → fokus ke `main`) [TERVERIFIKASI] |
| Target tombol nomor invoice di tabel | 54×14 px | 24 px tinggi (WCAG 2.5.8) [TERVERIFIKASI] |

Diperiksa otomatis (Playwright + Chrome, semua menu + detail invoice + form invoice baru): semua input/select/textarea/tombol punya nama aksesibel; tepat satu `h1` per tampilan; landmark `main/nav/aside/header` ada; `lang="id"`. Responsif: overflow horizontal 0 px pada 360, 768, 1280, 1920 px. Konsol: tidak ada error/warning baru; satu-satunya error adalah 403 yang diharapkan untuk token tidak valid. Bundle JS statis: 1.012 KB sebelum = sesudah. Kotak centang 13 px dibiarkan karena dibungkus `<label>` sehingga area kliknya mencakup teks. Belum diuji: pembaca layar nyata, Safari/Firefox, zoom 200% manual.

## 9. Hasil verifikasi

| Perintah | Baseline | Sesudah (kerja) | Clone bersih |
| --- | --- | --- | --- |
| `npm ci` | — | — | Lulus |
| `npm run typecheck` | Lulus | Lulus | Lulus (sebelum dan sesudah build) |
| `tsc --noUnusedLocals --noUnusedParameters` | 1 error | Lulus | — |
| `npm test` (Vitest) | 43/43 | 44/44 (+1 tes, +6 asersi regex) | 43/43 (sebelum perbaikan red-team) |
| `npm run format:check` | Lulus | Lulus | — |
| `npm run build` | Lulus | Lulus | Lulus |
| `npm run test:e2e` (Playwright, Chrome) | 6/6 | 6/6 | — (memerlukan Chrome; dijalankan di checkout kerja) |
| `npm audit` | 0 | 0 | 0 |
| Pemeriksaan header/konsol/overflow (skrip Playwright ad hoc) | — | Lulus prod + dev | — |

**Red-team pass** (sub-agent independen): semua rasio kontras, hash commit, dan rujukan `file:baris` cocok; tidak ditemukan secret di diff dan tidak ada file yang dihapus. Tiga temuan: (1) aturan regex terlalu ketat untuk `{n}` → diperbaiki; (2) pola lama yang tersimpan bisa memicu error → diperbaiki; (3) `connect-src` dev untuk websocket HMR → ditambahkan. Ketiganya diverifikasi ulang: 44/44 tes, build, 6/6 e2e, konsol dev dan prod bersih (commit `ba54f72`).

Linter: tidak ada ESLint (D5); pengganti yang dijalankan adalah `tsc` dengan pemeriksaan unused. [TIDAK DIUJI]: Safari/Firefox, pembaca layar, perangkat fisik (tidak tersedia di lingkungan ini).

## 10. Masalah tersisa & saran lanjutan (urut prioritas)

1. **Autentikasi/otorisasi + backup** sebelum data pelanggan nyata atau akses non-loopback (lihat MANUAL_ACTIONS).
2. Tambah ESLint (`eslint` + `eslint-config-next`) dan jalankan di pre-commit/CI.
3. Putuskan Tailwind: hapus (≈ hanya preflight) atau mulai pakai utilitasnya.
4. Pecah `src/app/page.tsx` (≈1.740 baris) per halaman untuk keterbacaan.
5. Pertimbangkan `failure()` mengembalikan pesan generik untuk error non-validasi.
6. Upgrade mayor TypeScript 7 / `@types/node` saat prasyarat Node dinaikkan.

## 11. Cara membatalkan

Lihat [ROLLBACK.md](ROLLBACK.md): `git checkout main` kembali ke baseline; `git revert <commit>` per tahap.
