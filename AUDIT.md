# Audit Tagih Tuntas — 18 Oktober 2026

Audit mencakup aturan bisnis, siklus status, validasi API, token pembeli, data CSV, penyimpanan lokal, UI, dan pengujian browser. Data pengguna di `data/db.json` tidak direset untuk pengujian; tes memakai direktori temporer.

## Temuan yang diperbaiki

| Prioritas | Temuan | Perbaikan |
| --- | --- | --- |
| Tinggi | Refresh menimpa status dijadwalkan bayar menjadi diterima pembeli. | Pertahankan status jadwal selama tidak ada hambatan baru; uji setelah pencatatan aktivitas. |
| Tinggi | API memungkinkan invoice lunas dimutasi/dikirim ulang. | Guard server untuk status terminal; draft juga tidak dapat langsung dilunasi/dijadwalkan. |
| Tinggi | Tautan lama tetap bisa mengubah invoice setelah pelunasan. | Cabut tautan saat lunas; guard di GET/POST pembeli; cabut manual dan otomatis saat reissue. |
| Tinggi | Laporan dokumen pembeli tertutup oleh verifikasi lama. | Tandai dokumen perlu pemeriksaan ulang; laporan tetap aktif sampai bukti baru cocok. |
| Tinggi | Catatan/sumber pembeli tertimpa diagnosis otomatis. | Pertahankan sumber `dilaporkan_pembeli` dan catatan asli. |
| Tinggi | Indikasi likuiditas bisa tetap aktif setelah administrasi menjadi tidak lengkap. | Tarik indikasi otomatis dengan alasan tersimpan; jangan dihitung sebagai hambatan yang berhasil diselesaikan. |
| Sedang | Diagnosis siklus dipengaruhi label penyebab manual. | Gunakan tanggal penyerahan atau rencana penyerahan draft; tanpa bukti cukup tetap tidak diketahui. |
| Sedang | Jadwal lewat tanpa pola lambat bayar bisa tidak memiliki diagnosis. | Kembalikan tidak diketahui; jangan menebak likuiditas. |
| Sedang | Tanggal mustahil, tipe metadata palsu, profil/hari tidak valid, dan regex kompleks belum ditolak. | Validasi tanggal kalender, tipe boolean/string, daftar hari, ukuran, kontak, pola nomor sederhana. |
| Sedang | Payment run dapat dipilih sebelum cut-off dalam siklus yang sama. | Pastikan pembayaran tidak mendahului cut-off, penyerahan, atau jatuh tempo. |
| Sedang | Draft/belum jatuh tempo ikut masuk angka piutang/umur terlambat. | Keluarkan draft dari saldo, pisahkan belum jatuh tempo dari kelompok umur. |
| Sedang | Simulasi mengurangi menit staf invoice administratif yang tepat waktu. | Batasi penghematan pada invoice administratif yang benar-benar terlambat. |
| Sedang | Importer menerima header duplikat/jumlah kolom tidak sesuai dan vendor tidak ada. | Tolak sebelum menyimpan; transaksi gagal tidak mengubah file. |
| Sedang | Mutasi tidak membatasi origin, host, dan ukuran body. | Guard JSON/origin/host lokal, pembacaan body terbatas, serta header privasi. |
| Sedang | Pemeriksaan origin awal menolak host lokal sah karena normalisasi URL Next. | Bandingkan Origin dengan Host permintaan; uji regresi dan browser. |
| Sedang | Pola `data/` dalam `.gitignore` ikut mengecualikan `src/app/api/data`. | Jadikan `/data/` sehingga hanya data runtime di root yang diabaikan. |
| Rendah | Tidak ada alur membuat invoice, filter status, ekspor audit, atau pengelolaan tautan. | Tambahkan formulir draft, filter, ekspor aman, daftar status tautan dan pencabutan. |
| Rendah | Perubahan di tab pembeli tidak segera terlihat di vendor. | Refresh saat tab fokus dan tombol Perbarui data; cegah respons lama menimpa data baru. |
| Rendah | Sumber kode terkompresi sulit ditinjau. | Format konsisten dengan Prettier; skrip format/check tersedia. |

## Pengujian

- **LULUS — Vitest: 43 kasus**, termasuk regresi terhadap status, terminal invoice, token, perubahan bukti, input, kalender, CSV, dan guard HTTP.
- **LULUS — Playwright: enam alur browser** pada build produksi, termasuk S1/S3/S4 lewat UI, navigasi, invoice baru, filter, audit, unduhan, profil, serta viewport 390×844.
- **LULUS — TypeScript, pemeriksaan format Prettier, dan build produksi** setelah perubahan.
- Enam alur browser selesai dalam 10,3 detik pada pemeriksaan final. Screenshot desktop dan ponsel diperiksa; tidak ada overflow horizontal pada viewport uji. Screenshot tersedia di `artifacts/dashboard-desktop.png` dan `artifacts/pelanggan-mobile.png`.

## Batas yang masih disengaja

1. **MVP lokal, bukan siap produksi publik.** Pemilih vendor bukan autentikasi; pengguna lokal yang dipercaya dapat membaca semua vendor. JSON satu proses tidak cocok untuk banyak instance, tanpa audit log antirusak, backup otomatis, atau akses pembeli jarak jauh.
2. **Model kalender sederhana.** Hari libur nasional, cut-off jam, dan beberapa payment run dalam sebulan belum didukung. Konfirmasi AP tetap diperlukan.
3. **Data simulasi.** Tanggal demo tetap, rasio lambat bayar/peluang selesai/reduksi manfaat adalah asumsi. Diagnosis bukan bukti pembeli insolven.
4. **CSV belum punya ID invoice historis wajib.** Impor menambah baris, tanpa deduplikasi otomatis; dua baris identik bisa berarti invoice berbeda. Operator harus menghindari impor berulang sampai identitas historis disepakati.
5. **Pengujian browser terbatas Chrome.** Viewport mobile bukan pengganti perangkat fisik; belum diuji Safari/Firefox, pembaca layar, atau beban banyak pengguna.
6. **Pembayaran dan dokumen tetap pencatatan manual.** Tidak ada bank, OCR, isi berkas, atau pengiriman pesan otomatis; bukti dan persetujuan berasal dari operator/pembeli.

Prioritas berikutnya bila MVP dipakai dengan data nyata: autentikasi/otorisasi, database transaksional dan backup, identitas invoice historis untuk deduplikasi, tanggal operasional nyata, lalu validasi manfaat bersama vendor/AP. Penambahan integrasi tidak diprioritaskan sebelum proporsi masalah administratif terukur.
