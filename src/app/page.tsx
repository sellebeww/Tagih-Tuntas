import type { Metadata } from "next";
import Motion from "./motion";
import "./profil.css";
export const metadata: Metadata = {
  title: "Tagih Tuntas · Profil perusahaan",
  description:
    "Tagih Tuntas membantu vendor B2B Indonesia menuntaskan piutang yang tertahan hambatan administratif.",
  robots: { index: true, follow: true },
};
const icon = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
  </svg>
);
const services = [
  {
    t: "Cek kelengkapan dokumen",
    d: "Faktur pajak, PO, BAST, cap dan tanda tangan dicocokkan dengan profil syarat bayar tiap pelanggan sebelum invoice dikirim.",
    i: "M7 3h7l5 5v13H7zM14 3v5h5M10 13l2 2 4-4",
  },
  {
    t: "Kalkulasi siklus bayar",
    d: "Hari tukar faktur, cut-off, dan payment run dihitung otomatis sehingga estimasi tanggal bayar realistis, bukan tebakan.",
    i: "M4 6h16v14H4zM4 10h16M9 3v5M15 3v5M9 15h2",
  },
  {
    t: "Diagnosis hambatan",
    d: "Delapan kategori hambatan, dari dokumen kurang hingga sengketa nominal, lengkap dengan tingkat keyakinan dan bukti.",
    i: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M8 11h6",
  },
  {
    t: "Antrean kerja prioritas",
    d: "Invoice diurutkan berdasarkan nilai, umur hambatan, dan peluang selesai supaya tim fokus pada yang paling berdampak.",
    i: "M4 6h16M4 12h10M4 18h6M18 14v6M15 17l3 3 3-3",
  },
  {
    t: "Tautan pembeli aman",
    d: "Pembeli mengonfirmasi penerimaan atau mengunggah dokumen lewat tautan sekali pakai yang kedaluwarsa dalam 72 jam.",
    i: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1",
  },
  {
    t: "Audit & evaluasi",
    d: "Impor invoice lama untuk melihat pola keterlambatan, lalu ukur dampak perbaikan dengan perbandingan yang jujur.",
    i: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  },
];
const steps = [
  ["Catat invoice", "Buat draft atau impor CSV invoice yang sedang berjalan."],
  [
    "Periksa syarat",
    "Sistem menolak pengiriman sampai seluruh syarat pelanggan terpenuhi.",
  ],
  [
    "Arahkan hambatan",
    "Setiap hambatan dikirim ke pemiliknya: penerima barang, pengadaan, atau AP.",
  ],
  [
    "Tuntas dibayar",
    "Jadwal dikonfirmasi, pelunasan dicatat, dan tautan aktif otomatis dicabut.",
  ],
];
const values = [
  [
    "Jujur pada ketidakpastian",
    "Bila sinyal tidak cukup, kami bilang “tidak diketahui” dan menyarankan bertanya ke AP. Kami tidak menebak.",
  ],
  [
    "Tidak memegang dana",
    "Kami tidak memproses pembayaran dan tidak memberi pembiayaan. Uang Anda tetap mengalir langsung dari pembeli.",
  ],
  [
    "Manusia tetap memutuskan",
    "Tidak ada pesan yang terkirim otomatis. Pratinjau pengingat disiapkan, dan tim Anda yang menentukan kapan mengirim.",
  ],
  [
    "Privasi sejak awal",
    "Yang kami simpan hanya metadata dokumen, bukan isinya. Token pembeli acak 256-bit dan hanya bisa dipakai sekali.",
  ],
];
export default function CompanyProfile() {
  return (
    <div className="cp">
      <Motion />
      <a className="skip" href="#cp-main">
        Lewati ke konten utama
      </a>
      <header className="cp-nav">
        <a
          className="cp-logo"
          href="#beranda"
          aria-label="Tagih Tuntas, ke atas"
        >
          <img src="/logo-mark.png" alt="" width={46} height={30} />
          <b>
            Tagih<span>Tuntas</span>
          </b>
        </a>
        <nav aria-label="Profil perusahaan">
          <a href="#tentang">Tentang</a>
          <a href="#layanan">Layanan</a>
          <a href="#cara-kerja">Cara kerja</a>
          <a href="#nilai">Nilai</a>
        </nav>
        <a className="cp-btn" href="/aplikasi">
          Buka aplikasi <span aria-hidden="true">→</span>
        </a>
      </header>
      <main id="cp-main">
        <section className="cp-hero" id="beranda">
          <div className="cp-blob a" />
          <div className="cp-blob b" />
          <div className="cp-hero-text">
            <p className="cp-eyebrow">
              <i /> Manajemen hambatan piutang B2B
            </p>
            <h1>
              Tagih rapi,
              <br />
              <em>bayar tuntas.</em>
            </h1>
            <p className="cp-lead">
              Di B2B Indonesia, invoice jarang tertahan karena pembeli tidak
              punya uang. Lebih sering karena faktur pajak belum lengkap, BAST
              belum ditandatangani, atau lewat cut-off tukar faktur. Tagih
              Tuntas menemukan hambatannya dan mengarahkan langkah yang tepat ke
              orang yang tepat.
            </p>
            <div className="cp-cta">
              <a className="cp-btn big" href="/aplikasi">
                Coba aplikasinya <span aria-hidden="true">→</span>
              </a>
              <a className="cp-ghost" href="#cara-kerja">
                Lihat cara kerja
              </a>
            </div>
          </div>
          <div className="cp-hero-art" aria-hidden="true">
            <div className="cp-ring" />
            <div className="cp-ring two" />
            <img
              className="cp-mark"
              src="/logo-mark.png"
              alt=""
              width={512}
              height={332}
            />
            <div className="cp-chip c1">
              <b className="ok">✓</b> Dokumen lengkap
            </div>
            <div className="cp-chip c2">
              <b className="warn">!</b> BAST belum dikonfirmasi
            </div>
            <div className="cp-chip c3">
              <b>◷</b> Estimasi bayar 26 Nov
            </div>
          </div>
        </section>
        <section className="cp-stats" data-reveal>
          <div>
            <strong data-count="8">8</strong>
            <span>kategori hambatan terdiagnosis</span>
          </div>
          <div>
            <strong>
              <span data-count="72">72</span> jam
            </strong>
            <span>masa berlaku tautan pembeli</span>
          </div>
          <div>
            <strong>
              <span data-count="256">256</span>-bit
            </strong>
            <span>token acak sekali pakai</span>
          </div>
          <div>
            <strong>
              Rp <span data-count="0">0</span>
            </strong>
            <span>dana pelanggan yang kami pegang</span>
          </div>
        </section>
        <section className="cp-section cp-about" id="tentang">
          <div data-reveal>
            <p className="cp-kicker">Tentang kami</p>
            <h2>Piutang bukan soal menagih lebih keras, tapi lebih jelas.</h2>
            <p>
              Tagih Tuntas lahir dari satu pengamatan sederhana: tim keuangan
              vendor menghabiskan waktu berhari-hari menelepon pembeli, padahal
              invoice tertahan karena satu dokumen yang kurang atau satu tanda
              tangan yang belum ada. Kami membangun ruang kerja yang membuat
              setiap invoice punya langkah berikutnya yang jelas.
            </p>
          </div>
          <div className="cp-vm" data-reveal>
            <article>
              <h3>Visi</h3>
              <p>
                Menjadi standar kerja penagihan B2B yang transparan di
                Indonesia, tempat vendor dan pembeli sama-sama tahu apa yang
                dibutuhkan agar invoice dibayar tepat waktu.
              </p>
            </article>
            <article>
              <h3>Misi</h3>
              <ul>
                <li>Memastikan invoice lengkap sebelum dikirim.</li>
                <li>Mengarahkan hambatan ke pemilik yang tepat.</li>
                <li>Memberi estimasi bayar yang jujur dan terukur.</li>
              </ul>
            </article>
          </div>
        </section>
        <section className="cp-section" id="layanan">
          <div className="cp-head" data-reveal>
            <p className="cp-kicker">Layanan</p>
            <h2>Satu ruang kerja, dari draft sampai lunas.</h2>
          </div>
          <div className="cp-grid">
            {services.map((s, n) => (
              <article
                className="cp-card"
                key={s.t}
                data-reveal
                style={{ transitionDelay: `${(n % 3) * 90}ms` }}
              >
                <div className="cp-icon">{icon(s.i)}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="cp-show" data-reveal>
          <div className="cp-browser">
            <div className="cp-bar">
              <i />
              <i />
              <i />
              <span>127.0.0.1 / dasbor piutang</span>
            </div>
            <img
              src="/screens/dashboard.png"
              alt="Tampilan dasbor piutang Tagih Tuntas"
              width={1440}
              height={900}
              loading="lazy"
            />
          </div>
          <div className="cp-float f1" aria-hidden="true">
            <small>Hambatan utama</small>
            <b>Dokumen kurang</b>
            <span className="cp-pill">keyakinan tinggi</span>
          </div>
          <div className="cp-float f2" aria-hidden="true">
            <small>Status invoice</small>
            <b>Dijadwalkan bayar</b>
            <span className="cp-progress">
              <i />
            </span>
          </div>
        </section>
        <section className="cp-section" id="cara-kerja">
          <div className="cp-head" data-reveal>
            <p className="cp-kicker">Cara kerja</p>
            <h2>Empat langkah menuju invoice yang tuntas.</h2>
          </div>
          <ol className="cp-steps" data-reveal>
            {steps.map(([t, d], n) => (
              <li key={t} style={{ transitionDelay: `${n * 120}ms` }}>
                <span className="cp-num">{n + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="cp-section cp-values" id="nilai">
          <div className="cp-head" data-reveal>
            <p className="cp-kicker">Nilai kami</p>
            <h2>Prinsip yang tidak kami tawar.</h2>
          </div>
          <div className="cp-vgrid">
            {values.map(([t, d], n) => (
              <article
                key={t}
                data-reveal
                style={{ transitionDelay: `${(n % 2) * 100}ms` }}
              >
                <span className="cp-check" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="cp-final" data-reveal>
          <img src="/logo-mark.png" alt="" width={160} height={104} />
          <h2>Siap menuntaskan piutang yang tertahan?</h2>
          <p>
            Jelajahi ruang kerja demo dengan lima vendor dan 150 invoice contoh.
          </p>
          <a className="cp-btn big light" href="/aplikasi">
            Masuk ke aplikasi <span aria-hidden="true">→</span>
          </a>
        </section>
      </main>
      <footer className="cp-foot">
        <img src="/logo.png" alt="Tagih Tuntas" width={120} height={82} />
        <p>
          Piutang lebih jelas. Metadata saja, tanpa memegang dana.
          <br />© 2026 Vassel Goleyu · Tagih Tuntas · Versi MVP
        </p>
        <a href="/aplikasi">Buka aplikasi →</a>
      </footer>
    </div>
  );
}
