# Cara Membatalkan Perubahan Audit

Repo Git dibuat pada audit ini (tanpa remote). Baseline sebelum perubahan: commit `9f40c36` di branch `main`. Semua perubahan ada di branch `chore/audit-20261019`.

| Commit | Isi |
| --- | --- |
| `88419d0` | ReDoS fix + tes, CSP/Permissions-Policy/`poweredByHeader`, `noindex`, kontras & fokus, `aria-current`, hapus import tak terpakai |
| `b906000` | Kembalikan `next-env.d.ts` (berkas buatan Next) ke varian build |
| `7b784bf` | Tautan "Lewati ke konten utama", target tombol tabel 24px |
| `eb8400a` | `.gitignore`: `.DS_Store`, `*.log` (pesan commit juga menyebut docs; README ada di commit berikut) |
| `b97e77c` | README: dokumentasi `TAGIH_DATA_FILE` |
| `c6919f0` | Dokumen `docs/audit/` |
| `ba54f72` | Perbaikan hasil red-team: `{n}`/escape diizinkan, pola lama tidak menyebabkan crash, `connect-src` dev |
| berikutnya | Pembaruan dokumen setelah red-team |

## Perintah

```sh
# Kembali sepenuhnya ke kondisi sebelum audit (branch audit tetap tersimpan)
git checkout main

# Batalkan satu perubahan tertentu di branch audit
git checkout chore/audit-20261019
git revert <commit>

# Lihat seluruh diff audit
git diff main..chore/audit-20261019
```

`data/db.json` tidak pernah di-commit atau diubah oleh audit (diabaikan `.gitignore`; semua uji memakai berkas temporer via `TAGIH_DATA_FILE`). Jika ingin menghapus Git sama sekali: hapus folder `.git` (semua file kerja tetap; riwayat hilang).
