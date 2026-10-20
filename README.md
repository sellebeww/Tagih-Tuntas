# TagihTuntas

MVP lokal pengelolaan hambatan piutang B2B Indonesia. Next.js App Router, TypeScript, Tailwind, JSON lokal. Tidak memegang dana, tidak memberi pembiayaan, tidak mengirim pesan otomatis, dan tidak terintegrasi dengan bank, akuntansi, atau e-Faktur.

## Menjalankan

Prasyarat Node.js 22.12+ dan npm. Dari direktori proyek, instalasi pertama sekaligus menjalankan:

```sh
npm install && npm start
```

Selanjutnya cukup `npm start`, buka http://127.0.0.1:3000. Server terikat loopback. Data dibuat otomatis pada akses pertama di `data/db.json`, tetap ada setelah restart. Variabel lingkungan opsional `TAGIH_DATA_FILE` mengganti lokasi berkas data (dipakai tes browser agar tidak menyentuh data lokal); tidak ada variabel rahasia. Menu **Skenario uji → Reset seluruh data demo** menghapus perubahan dan impor setelah konfirmasi.

```sh
npm test             # tes inti dan integrasi penyimpanan
npm run typecheck    # pemeriksaan TypeScript aplikasi
npm run build        # build produksi
npm run serve        # jalankan hasil build lokal
npm run test:e2e     # setelah build; memerlukan Google Chrome lokal
npm run format:check # konsistensi format kode
```

Tidak ada autentikasi vendor/admin: pemilih vendor adalah konteks kerja demo, bukan batas keamanan. Konfigurasi admin tersedia lewat profil dan berkas konfigurasi. Jangan mengekspos server ini ke internet atau menyimpan data pelanggan sungguhan tanpa autentikasi, otorisasi, pencatatan akses, dan penyimpanan yang sesuai. JSON ditulis atomik untuk satu proses; bukan untuk banyak instance/serverless. Tautan pembeli dapat dicoba pada browser lokal/tab terpisah; akses dari perangkat eksternal membutuhkan deployment dan kontrol akses vendor yang belum termasuk MVP ini.

## Struktur

- `src/core/model.ts`: Vendor, Buyer/ProfilSyaratBayar/Kontak, Order, Invoice, Doc, Blocker, BuyerLink, Activity, Historical.
- `src/core/config.ts`: seluruh parameter estimasi/eskalasi/kadensi dalam satu tempat, ditandai **asumsi, ganti dengan data nyata**.
- `src/core/seed.ts`: generator deterministik 5 vendor, 20 pelanggan, 150 invoice (30/vendor); metadata tanpa isi dokumen.
- `src/core/engine.ts`: fungsi murni kelengkapan, siklus, diagnosis, perutean, transisi, validasi token, kadensi, audit, evaluasi, metrik. Tidak bergantung UI atau database.
- `src/core/csv.ts`: parser CSV dengan quoted fields, validasi tanggal/nominal/kategori.
- `src/server/store.ts`: JSON lokal, mutasi, token acak 256-bit, aktivitas.
- `src/app`: dasbor, antrean, profil, detail, audit, evaluasi, skenario; `/beli/[token]` adalah tampilan pembeli; `/tentang` adalah profil perusahaan (tautan dua arah dengan aplikasi).
- `public/`: logo transparan (`logo.png`, `logo-mark.png`) dan tangkapan layar dasbor untuk profil perusahaan.
- `tests`: unit test dan integrasi penyimpanan terisolasi pada direktori temporer.
- `examples/audit.csv`: contoh impor.

## Aturan diagnosis dan mesin status

1. Kelengkapan membandingkan dokumen dengan profil pelanggan: jenis wajib, ekstensi, ukuran, PO, cap/tanda tangan, verifikasi vendor, pola nomor invoice. Metadata berstatus `belum` tidak dianggap cocok. Pengiriman ditolak sampai semua syarat terpenuhi.
2. Jadwal bulanan memakai hari tukar faktur, tanggal cut-off, tanggal payment run, hari kerja keuangan, dan jatuh tempo. Penyerahan bergeser ke hari tukar berikutnya; lewat cut-off berpindah ke bulan berikutnya. Hari bayar nonkerja bergeser ke hari kerja berikutnya. Tanggal 29–31 dipotong ke akhir bulan bila perlu. Hari libur nasional, cut-off jam, dan jadwal multi-payment-run belum dimodelkan. Estimasi bukan janji pembeli.
3. Dokumen kurang/format salah: keyakinan tinggi. BAST tanpa konfirmasi: penerima barang. Selisih invoice–PO atau laporan pembeli: sengketa, diarahkan ke pengadaan. Persetujuan belum ada: atasan.
4. Indikasi likuiditas berbasis aturan hanya muncul bila dokumen cocok, penerimaan terkonfirmasi, tidak ada selisih/sengketa, persetujuan lengkap, tanggal pembayaran terjadwal dan jatuh tempo sudah lewat, serta rasio riwayat lambat bayar ≥ 50%. Keyakinan sedang; bukan kepastian. Rasio seed asumsi, perlu diganti berdasarkan riwayat nyata. Laporan pembeli juga dicatat sebagai sumber tersendiri; bukan kesimpulan mesin.
5. Sinyal tidak cukup → tidak diketahui, tanyakan AP. Ketidakpastian bukan alasan untuk menebak masalah dokumen atau likuiditas.
6. `terbuka → menunggu_pihak_lain → selesai | tidak_bisa_diselesaikan`. Penutupan harus memenuhi bukti: dokumen cocok, penerimaan dikonfirmasi, sengketa direkonsiliasi, persetujuan dicatat, atau siklus dikonfirmasi. `tidak_diketahui` dapat ditutup ketika alasan lebih spesifik ditemukan. Server melakukan dua transisi sah secara berurutan saat bukti diterima. Status terminal tidak diubah; masalah berulang membuat hambatan baru.
7. Penjadwalan ditolak bila ada hambatan yang belum `selesai`, termasuk yang dinyatakan tidak bisa diselesaikan. Pengecualian hanya untuk indikasi otomatis yang telah ditarik karena bukti berubah (`invalidated`); penarikan tidak dihitung sebagai penyelesaian. Saat AP mengonfirmasi tanggal, hanya hambatan siklus yang memenuhi syarat penutup; hambatan lainnya tetap memblokir penjadwalan. Pelunasan dapat dicatat manual tanpa integrasi bank.
8. Kadensi: jeda 3 hari, hanya hari kerja AP; eskalasi setelah 7 hari. Teks pratinjau boleh disalin kapan saja; pencatatan pengingat/eskalasi mengikuti kadensi. Tidak ada pengiriman otomatis.
9. Antrean mengurutkan nilai × umur hambatan × peluang selesai asumsi (administratif 0,8; sengketa 0,3; tidak diketahui 0,2), terpisah dari likuiditas.

Token satu invoice, satu aksi, kedaluwarsa 72 jam **waktu nyata**, sekali pakai. GET pembeli hanya mengembalikan nomor, nilai, aksi, dan jenis dokumen yang dibutuhkan. Aksi yang dijalankan berasal dari token di server, bukan pilihan bebas klien. Unggahan metadata pembeli selalu `belum` dan memerlukan verifikasi vendor. Mengganti parameter invoice atau memakai ulang token ditolak. Nilai token tidak disertakan dalam API daftar vendor; hanya metadata status, aksi, kontak, dan kedaluwarsa. Vendor dapat mencabut tautan. Pembuatan ulang aksi yang sama mencabut tautan sebelumnya; pelunasan mencabut semua tautan aktif invoice tersebut.

## Menjalankan S1–S8

Pilih **Cetak Cemerlang**. Halaman **Skenario uji** menyediakan fixture terisolasi yang dapat diulang dan tombol **Detail** untuk mutasi data persisten. Reset bila ingin mengulang alur dari awal.

| Skenario | Langkah UI | Hasil yang diharapkan |
| --- | --- | --- |
| S1 | Jalankan S1, lalu Detail; coba tandai dikirim. Tambahkan Faktur pajak, `faktur.pdf`, 1 MB, nomor PO, cap, tanda tangan, status cocok; kirim ulang. | Awalnya ditolak. Setelah lengkap dapat dikirim. Fixture 5 Oktober menunjukkan pembayaran 26 Oktober (25 Oktober Minggu), masih dalam siklus Oktober. Detail memakai tanggal simulasi 18 Oktober sehingga siklusnya November; tidak berpura-pura dokumen bisa memperbaiki cut-off yang sudah lewat. |
| S2 | Jalankan S2 atau buka detail invoice kedua. | Lewat cut-off, estimasi pembayaran 26 November sesuai profil pelanggan kedua. |
| S3 | Detail invoice ketiga → Minta penerimaan → buka tampilan pembeli → centang dan kirim. Muat ulang detail vendor. | Hambatan penerimaan selesai, status menjadi diterima pembeli; catatan konfirmasi tersimpan. Jadwal seed November sengaja sudah dikonfirmasi sehingga tidak ada hambatan siklus tambahan. |
| S4 | Detail invoice keenam → Minta nominal → buka tautan dan isi alasan selisih. Muat ulang vendor. | Status disengketakan, alasan tampil, pengadaan menjadi penanggung jawab. Dapat dicatat kesepakatan nominal melalui catatan dan nilai disetujui pada detail. |
| S5 | Jalankan S5 atau detail invoice kelima. | Hanya indikasi likuiditas, keyakinan sedang, sinyal ditampilkan. Terpisah dari antrean administratif dan tidak memperoleh manfaat simulasi. |
| S6 | Jalankan S6/detail invoice keenam sebelum dimodifikasi. | Tidak diketahui, keyakinan rendah, tindakan meminta alasan kepada AP. |
| S7 | Jalankan S7. Untuk alur nyata, buat tautan, ubah parameter `invoice` di URL, atau gunakan lagi sesudah jawaban terkirim. | Fixture menolak token kedaluwarsa dan invoice salah; endpoint nyata menolak invoice salah dan pemakaian ulang. |
| S8 | Jalankan S8 (beralih ke audit Seragam Prima). | 81,7% hari keterlambatan berasal dari likuiditas. Laporan menegaskan potensi alat terbatas. |

Tanggal operasi demo tetap **2026-10-18** (`config.demoToday`), terpisah dari masa berlaku token. Ini hari Minggu; tombol pencatatan pengingat dinonaktifkan untuk profil Senin–Jumat. Ubah konfigurasi untuk eksperimen kadensi hari lain. Tidak ada tugas terjadwal di latar belakang.

## Audit dan gerbang go/no-go

Impor CSV dengan header `pelanggan,nilai,tanggal_terbit,jatuh_tempo,tanggal_bayar,penyebab,menit_staf`. Enam kolom pertama wajib; tanggal bayar boleh kosong, menit staf opsional default 0. Gunakan YYYY-MM-DD dan angka Rupiah tanpa pemisah ribuan. Penyebab wajib salah satu kategori di model (contoh di UI). Nilai nonpositif, tanggal tidak valid, atau penyebab tak dikenal ditolak sebelum penyimpanan; tidak ada impor parsial. Impor menambahkan baris; tidak ada deduplikasi otomatis. Koreksi klasifikasi melalui pilihan per baris di audit.

Hari-invoice = `max(0, tanggal bayar atau tanggal simulasi − jatuh tempo)`, dijumlahkan tanpa pembobotan Rupiah. Nilai pernah tertahan = jumlah pokok invoice yang pernah terlambat, termasuk yang sudah lunas; bukan saldo piutang hari ini. Pembagian dihitung dari penyebab utama manual, sehingga satu invoice tidak dihitung berulang. Dashboard hambatan dapat memiliki beberapa kategori per invoice.

Hasil seluruh seed, **asumsi yang harus diganti audit nyata**:

| Penyebab | Invoice | Nilai pernah tertahan | Hari-invoice |
| --- | ---: | ---: | ---: |
| Administratif | 63 (42%) | Rp 681.750.000 | 3.696 |
| Sengketa | 21 (14%) | Rp 258.750.000 | 1.232 |
| Likuiditas | 45 (30%) | Rp 625.500.000 | 2.600 |
| Tidak diketahui | 21 (14%) | Rp 290.250.000 | 1.232 |

Keputusan gerbang: **GO untuk menguji prototipe, belum GO untuk klaim manfaat atau peluncuran komersial.** Administratif hanya 42,2% hari-invoice seed. Pada Seragam Prima, 1.432 dari 1.752 hari-invoice (81,7%) adalah likuiditas. **Sebagian besar masalahnya likuiditas; potensi alat ini terbatas untuk vendor itu.** Ini hasil validasi yang sah, bukan kegagalan klasifikasi yang harus disamarkan sebagai masalah dokumen.

## Evaluasi dan asumsi

Tiga mode memakai baris historis sama. Proses sekarang memakai baseline seed/impor. Pengecekan awal diasumsikan menurunkan hari administratif 40% dan menit staf 20%; tambahan perutean/tautan diasumsikan menurunkan 65% dan 40%. Ini skenario sensitivitas agregat, bukan prediksi per invoice atau hubungan sebab-akibat yang telah terbukti. Persetujuan/siklus termasuk administratif; asumsi cek awal merupakan batas potensi kasar dan perlu dikalibrasi per penyebab. Nilai pokok tertahan ditampilkan **tetap sama**: tidak ada model tanggal pembayaran kontrafaktual untuk mengklaim penurunan saldo Rp.

Likuiditas, sengketa, dan tidak diketahui tidak berubah dalam kedua simulasi. Biaya staf = menit/60 × Rp45.000/jam (asumsi). Metrik operasional menampilkan hari buka–selesai per kategori, terbit–lunas, menit per invoice, dan persentase lengkap pada pengiriman pertama. Baseline kelengkapan seed diasumsikan, pengiriman baru hanya diizinkan setelah pengecekan lulus. Bukti hubungan pembayaran dengan kelengkapan belum tersedia.

## Risiko & Validasi

- **Pemisahan penyebab:** audit invoice lama dan periksa bukti bersama vendor/AP; ukur administratif vs sengketa vs likuiditas serta jumlah tidak diketahui. Klasifikasi berdasarkan ingatan rawan bias; jangan memaksakan kategori.
- **Kemauan pembeli memakai tautan:** ukur tautan dibuka/diselesaikan versus jawaban WhatsApp, waktu respons, dan alasan penolakan. MVP baru mencatat penyelesaian; pengukuran pembukaan belum ada.
- **Kebenaran profil:** tunjuk pemilik profil; verifikasi bersama AP saat onboarding dan setelah penolakan/perubahan aturan. Catat pengalaman dan tinjau berkala; versioning profil belum tersedia.
- **Beban kerja baru:** catat menit membuat profil, menyiapkan dokumen, tindak lanjut, dan penyelesaian. Bandingkan penghematan bersih, bukan hanya jumlah pesan. Log menit invoice tersedia; waktu onboarding profil masih perlu diukur di luar aplikasi.
- **Pembeda:** pemeriksaan sebelum pengiriman memakai syarat spesifik pelanggan; siklus dan kontak per peran menentukan tindakan; tautan pembeli memperbarui bukti penutup langsung. Uji apakah manfaat ini terasa dibanding checklist spreadsheet/WhatsApp dan alat sengketa umum. Ini hipotesis produk, bukan klaim bahwa pesaing tidak memiliki fitur tersebut.
- **Uji inti:** bandingkan kelompok administratif yang sebanding sebelum/sesudah intervensi; ukur hari tertahan dan menit staf, kendalikan nilai, pelanggan, dan musim. Jangan menghitung likuiditas/sengketa sebagai penurunan yang disebabkan aplikasi. Jika administrasi kecil atau beban input lebih besar dari manfaat, hasilnya NO-GO atau ubah segmen.

## Batasan MVP

Pilih vendor tanpa autentikasi; satu mesin/satu proses; metadata dokumen manual; tidak ada OCR, isi berkas, tanda tangan digital, pembayaran, factoring, native mobile, integrasi bank/akuntansi/e-Faktur. Kontak hanya metadata kanal, tidak ada pengiriman email/WhatsApp. Bukti verifikasi dan kesepakatan nominal dicatat oleh operator, bukan verifikasi independen. UI responsif diuji pada Google Chrome desktop dan viewport ponsel 390×844; Safari/Firefox dan perangkat fisik belum diuji. Audit historis terpisah dari invoice operasional dan tidak mengubah invoice aktif. Semua data seed fiktif dan domain kontak `.invalid`.

## Verifikasi implementasi

- 43 tes Vitest lulus: aturan inti, integrasi penyimpanan/token, dan regresi audit.
- TypeScript lulus; build produksi Next.js dengan webpack berhasil.
- Smoke test HTTP: halaman utama dan API data 200; API pembeli dengan token tidak valid 403; API vendor tidak mengekspos daftar token.
- `npm audit` setelah pembaruan Vitest: 0 kerentanan pada saat pengerjaan.
- Enam skenario Playwright lulus untuk navigasi, invoice baru, dokumen, konfirmasi/nominal pembeli, jadwal pembayaran, impor/ekspor, profil, dan viewport ponsel. Tes memakai build produksi serta database temporer, bukan data lokal pengguna.
- Webpack dipakai untuk dev/build karena Turbopack membutuhkan port proses internal yang dibatasi lingkungan pengerjaan.


## Perbaikan hasil audit lanjutan

Lihat [AUDIT.md](AUDIT.md) untuk daftar temuan dan verifikasi. Tambahan UI: **Invoice baru**, filter status, **Perbarui data**, pencabutan tautan, dan **Ekspor CSV audit**. Jatuh tempo draft baru otomatis mengikuti termin pelanggan. Nomor invoice unik per vendor. Draft tidak dihitung sebagai saldo piutang; saldo belum jatuh tempo dipisahkan dari kelompok terlambat. Ekspor CSV mengutip nilai dan menetralkan awalan formula spreadsheet; nama pelanggan yang diawali karakter formula akan mendapat apostrof pelindung.

Penjadwalan sekarang memerlukan bukti konfirmasi AP, tanggal kalender valid, hari kerja AP, dan invoice yang telah dikirim. Status jadwal bertahan setelah pencatatan aktivitas. Invoice lunas/dihapus buku menolak perubahan operasional; catatan aktivitas tetap dapat ditambahkan. Perubahan nominal menyimpan nilai invoice dan PO sebelumnya pada log.

Laporan pembeli mempertahankan sumber serta catatan aslinya. Bila pembeli menyatakan dokumen kurang/tidak sesuai, metadata lama ditandai belum diverifikasi agar tidak langsung menutup laporan. Vendor harus memeriksa ulang semua dokumen wajib. Indikasi likuiditas otomatis ditarik bila prasyaratnya tidak lagi terpenuhi; histori tetap ada dan tidak dianggap manfaat aplikasi.

Diagnosis siklus menggunakan `submittedAt`, atau tanggal rencana penyerahan untuk draft. Tanpa bukti penyerahan, sistem tidak menyimpulkan siklus terlewat hanya dari label penyebab manual. Tanggal pembayaran yang sudah lewat tanpa pola riwayat memadai kembali menjadi tidak diketahui, bukan otomatis likuiditas. Data lama tanpa `submittedAt` tetap dapat dibaca; riwayat hambatan lama tidak dihapus otomatis. Seed baru mengisi tanggal penyerahan untuk contoh terlewat siklus.

Permintaan mutasi harus JSON, berasal dari origin yang sama bila header tersedia, dan dibatasi sekitar 1 MB. Host API dibatasi localhost/127.0.0.1/[::1], sesuai mode lokal. Header no-store/no-referrer, pencegahan framing, dan pembatasan pola nomor mengurangi kebocoran token serta input bermasalah. Ini **bukan pengganti autentikasi atau otorisasi**; semua vendor dalam MVP adalah ruang kerja operator lokal yang dipercaya.

Pengujian browser memerlukan Chrome pada mesin. Jalankan `npm run build` lalu `npm run test:e2e`; server uji otomatis memakai port 3100, file temporer, dan berhenti setelah tes. Jangan jalankan build dan dev bersamaan pada checkout yang sama. Screenshot audit tersimpan di `artifacts/` dan kegagalan tes di `test-results/`.
