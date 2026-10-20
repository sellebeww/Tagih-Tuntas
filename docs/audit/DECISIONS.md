# Keputusan Otonom — Audit 19 Oktober 2026

| # | Keputusan | Alasan | Alternatif yang ditolak |
| --- | --- | --- | --- |
| D1 | Membuat repo Git lokal (`main` = baseline `9f40c36`) dan bekerja di `chore/audit-20261019`. | Proyek belum memakai Git; perlu titik pulih per tahap. Tanpa remote. | Arsip zip (lebih sulit ditinjau per perubahan). |
| D2 | Batas kuantifier regex dihitung atas `+ * ?` dan rentang `{m,n}` (maks. 2; `{n}` tetap dan escape tidak dihitung), bukan menambah timeout. Pola tersimpan yang tidak valid ditandai di `completeness`, tidak melempar error. | Memakai mekanisme yang sudah ada; terbukti menolak pola macet sambil menerima format umum (`^\d{3}/INV/\d{2}/\d{4}$`). Data lokal hanya memakai `^INV-` (diperiksa). | Engine regex linear (dependensi baru `re2`), worker + timeout (kode lebih banyak). |
| D3 | CSP mengikuti contoh resmi Next 16 "Without Nonces" tanpa `upgrade-insecure-requests`. | Aplikasi sengaja berjalan di `http://127.0.0.1`; direktif itu bisa memaksa HTTPS. `'unsafe-eval'` hanya di mode development (dibutuhkan webpack dev). | CSP berbasis nonce (memaksa semua halaman dinamis; berlebihan untuk MVP lokal). |
| D4 | `--muted` digelapkan `#70827c` → `#5e706a`; cincin fokus hijau gelap di latar terang. | Kontras sebelumnya 3,7:1 dan 1,8:1 (gagal WCAG AA); perubahan visual minimal. | Mendesain ulang palet. |
| D5 | Tidak menambah ESLint. | Next 16 menghapus `next lint`; menambah ESLint berarti puluhan paket dev baru. Pemeriksaan unused dilakukan via `tsc --noUnusedLocals --noUnusedParameters` (lulus). Prettier sudah ada. | Memasang `eslint` + `eslint-config-next` (dicatat sebagai saran). |
| D6 | Tailwind tidak dihapus walau hampir tidak dipakai. | Hanya menyumbang preflight/reset CSS; penghapusan mengubah tampilan dasar → perlu persetujuan. | Hapus `tailwindcss`, `@tailwindcss/postcss`, `postcss.config.mjs`. |
| D7 | Tidak memperbarui versi mayor (TypeScript 7, `@types/node` 26). | Berpotensi breaking; `@types/node` 22 sesuai prasyarat Node 22 di README. `npm audit` = 0. | Upgrade otomatis. |
| D8 | `next-env.d.ts` dikembalikan ke varian build (baseline). | Berkas buatan Next yang berganti isi antara `dev` dan `build`; perubahan itu bukan perubahan disengaja. | Menambahkan ke `.gitignore` (berisiko typecheck gagal pada clone baru sebelum `next build`). |
| D9 | `page.tsx` (≈1.740 baris) tidak dipecah. | Refactor besar tanpa manfaat fungsional; aturan "tidak ada refactor besar". | Pecah per halaman (dicatat sebagai saran). |
| D10 | `AUDIT.md` lama di root dipertahankan. | Catatan keputusan sebelumnya; dirujuk README. | Memindahkan ke `docs/audit/`. |
| D11 | Screenshot `artifacts/*.png` yang ditulis ulang e2e ikut di-commit. | Dirujuk e2e/README sebagai bukti visual; versi baru mencerminkan UI terkini. | Mengembalikan versi lama. |
