# Tindakan Manual

Hanya hal yang tidak dapat dikerjakan agent. Tidak ada secret yang perlu dirotasi (tidak ditemukan secret). Tidak ada item yang memblokir pemakaian lokal/demo saat ini.

| # | Prioritas | Blokir rilis? | Apa & kenapa | Langkah persis | Waktu | Laporkan balik |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Tinggi | Tidak | **Tinjau dan terima perubahan audit.** Perubahan ada di branch terpisah; menggabungkan ke `main` adalah keputusan Anda. | `git diff main..chore/audit-20261019` → bila setuju: `git checkout main && git merge chore/audit-20261019`. Bila tidak: biarkan di `main`. | 10–15 menit | Diterima/ditolak, commit mana yang ditolak |
| 2 | Tinggi | **Ya**, untuk data pelanggan nyata atau akses dari jaringan/internet | **Putuskan model autentikasi, otorisasi per vendor, dan penyimpanan** (bukan JSON satu proses). Ini keputusan produk/hukum (PII pelanggan, UU PDP). | Tentukan: penyedia login, siapa boleh melihat vendor mana, database + backup, lokasi hosting. Sampai saat itu, tetap jalankan via `npm start` (loopback). | Keputusan: 1–2 jam | Pilihan yang diambil |
| 3 | Sedang | Tidak | **Backup `data/db.json`** bila sudah berisi data yang ingin disimpan. Berkas ini tidak masuk Git (sengaja). | Salin berkala: `cp data/db.json ~/Backup/tagih-$(date +%F).json` | 1 menit | — |
| 4 | Rendah | Tidak | **Uji manual di Safari/Firefox, ponsel fisik, dan pembaca layar (VoiceOver).** Tidak tersedia di lingkungan agent. | `npm start` → buka http://127.0.0.1:3000 di Safari; VoiceOver: Cmd+F5, navigasi Tab dari "Lewati ke konten utama" lewat menu, filter, detail invoice; zoom 200% (Cmd +). | 30 menit | Masalah yang ditemukan + halaman |
| 5 | Rendah | Tidak | **Keputusan opsional**: tambah ESLint, hapus Tailwind, upgrade TypeScript 7 (lihat DECISIONS D5–D7). | Jawab ya/tidak per butir; agent dapat mengerjakannya. | 5 menit | Ya/tidak per butir |
