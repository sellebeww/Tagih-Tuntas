# Model Ancaman — Tagih Tuntas (19 Oktober 2026)

Aplikasi lokal Next.js 16 (App Router) + berkas JSON (`data/db.json`), satu proses Node, terikat `127.0.0.1`. Secara bawaan tanpa autentikasi dan hanya menerima localhost. Mode hosting (Vercel + Redis) menambahkan kata sandi bersama `APP_PASSWORD`, cookie sesi HMAC, dan pembatasan percobaan masuk best-effort; tetap tanpa otorisasi per vendor.

## Aset

1. Data piutang, profil, dan kontak pelanggan di `data/db.json` (berpotensi PII bila dipakai dengan data nyata).
2. Token tautan pembeli (256-bit, sekali pakai, 72 jam) yang memberi hak mengubah bukti invoice.
3. Integritas status/bukti invoice dan log aktivitas (dasar keputusan bisnis).
4. Ketersediaan satu proses Node (satu macet = aplikasi mati).

## Titik masuk

- `GET/POST /api/data`: operasi vendor (mutasi, reset, impor CSV, profil termasuk pola regex).
- `GET/POST /api/buyer` + halaman `/beli/[token]`: pihak pembeli yang memegang token.
- Impor/ekspor CSV, berkas data di disk, dependensi npm/build.

## Batas kepercayaan

Browser ↔ server loopback; pembeli (tidak tepercaya, hanya pemegang token) vs operator vendor (tepercaya, tanpa login); situs lain yang dibuka di browser yang sama (CSRF/DNS rebinding); sistem berkas lokal.

## Ancaman teratas dan status

| # | Ancaman | Kontrol | Status |
| --- | --- | --- | --- |
| 1 | CSRF dari situs lain ke `/api/*` | Cek `Origin`/`Sec-Fetch-Site`, wajib `application/json` (`src/server/http.ts`) | Sudah ada, diuji |
| 2 | DNS rebinding | Allowlist Host loopback | Sudah ada, diuji |
| 3 | Pencurian/pemakaian ulang token | 256-bit acak, sekali pakai, kedaluwarsa, `no-referrer`, token disamarkan di API vendor | Sudah ada, diuji |
| 4 | ReDoS lewat pola nomor invoice di profil | Batas kuantifier `+ * ? {` ≤ 2 | **Diperbaiki** pada audit ini |
| 5 | XSS | React escaping, tanpa `dangerouslySetInnerHTML`; CSP | CSP **ditambahkan** |
| 6 | Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` | Diperkuat |
| 7 | Injeksi formula CSV saat ekspor | Prefiks apostrof + quoting | Sudah ada |
| 8 | Server terekspos ke jaringan/internet tanpa auth | Bind loopback; tanpa `APP_PASSWORD` API menolak host non-localhost; peringatan README | Keputusan manual sebelum deploy |
| 9 | Kehilangan/korupsi data | Tulis atomik, mode 0600 | Backup belum ada (manual) |
| 10 | Supply chain | Lockfile ter-commit, `npm audit` 0 | Sudah ada |

## Lingkungan uji yang tersedia

Node 25.2.1, npm 11.6.2, Vitest, Playwright + Google Chrome lokal (headless). Tidak ada Docker, DB, atau CI. Safari/Firefox/pembaca layar/perangkat fisik tidak tersedia.
