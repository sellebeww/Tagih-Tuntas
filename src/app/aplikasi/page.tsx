"use client";
import { useEffect, useState, useRef } from "react";
import { DB, Invoice, Buyer, Profile, Doc, Contact } from "@/core/model";
import {
  audit,
  comparison,
  completeness,
  cycle,
  days,
  labels,
  message,
  metrics,
  cadence,
  diagnose,
  validateToken,
  actionable,
} from "@/core/engine";
import { config } from "@/core/config";
import { seed } from "@/core/seed";
import { categories, exportCSV } from "@/core/csv";
const money = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
const short = (n: number) =>
  n >= 1e9
    ? `Rp ${(n / 1e9).toFixed(2)} M`
    : n >= 1e6
      ? `Rp ${(n / 1e6).toFixed(1)} jt`
      : money(n);
const text = (s: string) => s.replaceAll("_", " ");
const status = (s: string) => text(s).replace(/^./, (c) => c.toUpperCase());
const today = config.demoToday;
const menus = [
  "Dasbor piutang",
  "Antrean kerja",
  "Pelanggan",
  "Audit invoice lama",
  "Evaluasi",
  "Skenario uji",
];
type Send = (
  input: Record<string, unknown>,
) => Promise<Record<string, unknown> | null>;
export default function Home() {
  const mutationLock = useRef(false);
  const loadVersion = useRef(0);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("semua");
  const [db, setDB] = useState<DB>(),
    [vendor, setVendor] = useState("v1"),
    [page, setPage] = useState(menus[0]),
    [selected, setSelected] = useState<string>(),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  async function load() {
    const version = ++loadVersion.current;
    const r = await fetch("/api/data", { cache: "no-store" });
    if (!r.ok)
      throw Error(
        (await r.json().catch(() => null))?.error ||
          "Tidak dapat membaca data.",
      );
    const data = await r.json();
    if (version === loadVersion.current) setDB(data);
  }
  useEffect(() => {
    const refresh = () => {
      if (!mutationLock.current) load().catch((e) => setNotice(e.message));
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  const send: Send = async (input) => {
    if (mutationLock.current) return null;
    mutationLock.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: vendor, ...input }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      await load();
      setNotice(
        result.count
          ? `${result.count} baris berhasil diimpor.`
          : "Perubahan tersimpan.",
      );
      return result;
    } catch (e) {
      setNotice((e as Error).message);
      return null;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  };
  if (!db)
    return (
      <main className="boot" aria-busy={!notice}>
        <img src="/logo-mark.png" alt="" width={64} height={41} />
        <b className="boot-name">
          Tagih<span>Tuntas</span>
        </b>
        {notice ? (
          <>
            <p role="alert">{notice}</p>
            <button
              className="btn"
              onClick={() => load().catch((e) => setNotice(e.message))}
            >
              Coba lagi
            </button>
          </>
        ) : (
          <>
            <div className="boot-bar" aria-hidden="true">
              <i />
            </div>
            <p role="status">Menyiapkan ruang kerja…</p>
          </>
        )}
        <a href="/">← Kembali ke profil perusahaan</a>
      </main>
    );
  const invoices = db.invoices.filter((i) => i.vendorId === vendor),
    buyers = db.buyers.filter((b) => b.vendorId === vendor),
    history = db.history.filter((h) => h.vendorId === vendor);
  const open = invoices.filter(
    (i) => !["draft", "dibayar", "dihapus_buku"].includes(i.status),
  );
  const blockers = open.flatMap((i) => i.blockers.filter(actionable));
  const selectedInvoice = invoices.find((i) => i.id === selected);
  const totals = audit(history, today),
    m = metrics(invoices);
  const openInvoice = (id: string) => {
    setSelected(id);
    setPage("Detail invoice");
  };
  const table = (rows: Invoice[]) => (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Invoice / pelanggan</th>
            <th>Nilai</th>
            <th>Lewat tempo</th>
            <th>Status</th>
            <th>Hambatan utama</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id}>
              <td>
                <button className="link" onClick={() => openInvoice(i.id)}>
                  {i.number}
                </button>
                <div className="muted" style={{ marginTop: 5 }}>
                  {buyers.find((b) => b.id === i.buyerId)?.name}
                </div>
              </td>
              <td>{money(i.value)}</td>
              <td>
                {i.paid
                  ? "Lunas"
                  : i.due > today
                    ? "Belum jatuh tempo"
                    : `${days(i.due, today)} hari`}
              </td>
              <td>
                <span className="badge">{status(i.status)}</span>
              </td>
              <td>
                {i.blockers.find((h) => actionable(h)) ? (
                  <span
                    className={`badge ${i.blockers.some((h) => h.category === "kemungkinan_likuiditas" && actionable(h)) ? "red" : "warn"}`}
                  >
                    {labels[i.blockers.find((h) => actionable(h))!.category]}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="empty">Tidak ada invoice pada daftar ini.</div>
      )}
    </div>
  );
  return (
    <div className="shell">
      <a className="skip" href="#konten">
        Lewati ke konten utama
      </a>
      <aside className="sidebar">
        <a className="brand" href="/" title="Profil perusahaan">
          <img src="/logo-mark.png" alt="" width={44} height={28} />
          <b>
            Tagih<span>Tuntas</span>
          </b>
        </a>
        <div className="subtitle">Piutang lebih jelas</div>
        <nav className="nav">
          {menus.map((x, n) => (
            <button
              className={page === x ? "active" : ""}
              aria-current={page === x ? "page" : undefined}
              key={x}
              onClick={() => setPage(x)}
            >
              <span aria-hidden="true" style={{ marginRight: 11 }}>
                {["◫", "☷", "▦", "⇧", "◷", "◇"][n]}
              </span>
              {x}
            </button>
          ))}
        </nav>
        <a className="profile-link" href="/">
          ← Profil perusahaan
        </a>
        <footer>
          <strong>Ruang kerja demo</strong>
          <br />
          Metadata saja · tanpa dana
          <br />
          <br />© 2026 Vassel Goleyu
        </footer>
      </aside>
      <main className="main" id="konten" tabIndex={-1}>
        <header className="top">
          <span className="overline">Ruang kerja vendor / {page}</span>
          <select
            aria-label="Pilih vendor"
            value={vendor}
            onChange={(e) => {
              setVendor(e.target.value);
              setSelected(undefined);
              if (page === "Detail invoice") setPage(menus[0]);
            }}
          >
            {db.vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </header>
        {notice && (
          <div role="status" className="notice">
            {notice}
            <button
              aria-label="Tutup pemberitahuan"
              onClick={() => setNotice("")}
            >
              ✕
            </button>
          </div>
        )}
        <div className="heading">
          <div>
            <div className="overline">{today} · tanggal simulasi tetap</div>
            <h1>
              {page === "Detail invoice"
                ? selectedInvoice?.number
                : page === "Dasbor piutang"
                  ? "Setiap invoice, jelas langkahnya."
                  : page}
            </h1>
            <div className="muted">
              {page === "Dasbor piutang"
                ? "Kenali yang tertahan. Lengkapi yang kurang. Arahkan ke orang yang tepat."
                : "Kelola hambatan administratif dengan bukti dan tindakan yang jelas."}
            </div>
          </div>
          <div className="actions">
            <button
              className="btn secondary small"
              disabled={busy}
              onClick={() =>
                load()
                  .then(() => setNotice("Data diperbarui."))
                  .catch((e) => setNotice(e.message))
              }
            >
              Perbarui data
            </button>
            <span className="badge">● Data simulasi</span>
          </div>
        </div>
        {page === menus[0] && (
          <>
            <div className="stats">
              <Stat
                title="PIUTANG BELUM LUNAS"
                value={short(open.reduce((s, i) => s + i.value, 0))}
                note={`${open.length} invoice aktif`}
              />
              <Stat
                title="NILAI TERTAHAN"
                value={short(
                  open
                    .filter((i) => i.status === "tertahan")
                    .reduce((s, i) => s + i.value, 0),
                )}
                note="Tidak termasuk sengketa terpisah"
              />
              <Stat
                title="HAMBATAN AKTIF"
                value={String(blockers.length)}
                note="Satu invoice bisa memiliki beberapa"
              />
              <Stat
                title="LENGKAP SAAT KIRIM"
                value={`${Math.round(m.firstComplete * 100)}%`}
                note="Asumsi baseline seed"
              />
            </div>
            <div className="grid">
              <section className="card">
                <h2>Di mana invoice tersangkut?</h2>
                {categories.map((c) => {
                  const n = blockers.filter((h) => h.category === c).length;
                  return (
                    n > 0 && (
                      <div className="barrow" key={c}>
                        <div className="row">
                          <span>{labels[c]}</span>
                          <strong>{n}</strong>
                        </div>
                        <div className="bar">
                          <i
                            style={{
                              width: `${(n / Math.max(1, blockers.length)) * 100}%`,
                              background:
                                c === "kemungkinan_likuiditas"
                                  ? "#b77a6c"
                                  : undefined,
                            }}
                          />
                        </div>
                      </div>
                    )
                  );
                })}
              </section>
              <section className="card">
                <h2>Penanggung jawab</h2>
                {[
                  "vendor",
                  "pengadaan",
                  "penerima_barang",
                  "keuangan_ap",
                  "atasan",
                ].map((role) => (
                  <div className="barrow row" key={role}>
                    <span>
                      {text(role)
                        .replace(/^./, (c) => c.toUpperCase())
                        .replace(/\bap\b/, "AP")}
                    </span>
                    <span className="badge">
                      {blockers.filter((h) => h.owner === role).length} hambatan
                    </span>
                  </div>
                ))}
                <div className="banner">
                  Indikasi likuiditas memerlukan keputusan bisnis. Kelengkapan
                  dokumen tidak menjamin kemampuan bayar.
                </div>
              </section>
            </div>
            <section className="card">
              <div className="row">
                <h2 style={{ marginRight: "auto" }}>Daftar invoice</h2>
                <button
                  className="btn"
                  onClick={() => setShowCreate(!showCreate)}
                >
                  {showCreate ? "Tutup formulir" : "+ Invoice baru"}
                </button>
                <input
                  aria-label="Cari invoice"
                  placeholder="Cari nomor / pelanggan"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {showCreate && (
                <NewInvoice
                  key={vendor}
                  buyers={buyers}
                  send={send}
                  busy={busy}
                  done={(id) => {
                    setShowCreate(false);
                    openInvoice(id);
                  }}
                />
              )}
              <label>
                Filter status
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="semua">Semua status</option>
                  {[
                    "draft",
                    "dikirim",
                    "diterima_pembeli",
                    "tertahan",
                    "dijadwalkan_bayar",
                    "dibayar",
                    "disengketakan",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {status(s)}
                    </option>
                  ))}
                </select>
              </label>
              {table(
                invoices
                  .filter(
                    (i) =>
                      statusFilter === "semua" || i.status === statusFilter,
                  )
                  .filter((i) =>
                    (i.number + buyers.find((b) => b.id === i.buyerId)?.name)
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  ),
              )}
            </section>
            <section className="card">
              <h2>Umur piutang sejak jatuh tempo</h2>
              <p className="muted">
                Belum jatuh tempo:{" "}
                {money(
                  open
                    .filter((i) => i.due > today)
                    .reduce((s, i) => s + i.value, 0),
                )}
                . Draft belum dihitung sebagai piutang.
              </p>
              <div className="stats">
                {[
                  [0, 30],
                  [31, 60],
                  [61, 90],
                  [91, 99999],
                ].map(([a, b]) => (
                  <Stat
                    key={a}
                    title={b === 99999 ? "> 90 HARI" : `${a}–${b} HARI`}
                    value={short(
                      open
                        .filter(
                          (i) =>
                            i.due <= today &&
                            days(i.due, today) >= a &&
                            days(i.due, today) <= b,
                        )
                        .reduce((s, i) => s + i.value, 0),
                    )}
                    note="Invoice belum lunas"
                  />
                ))}
              </div>
            </section>
          </>
        )}
        {page === menus[1] && (
          <>
            <div className="banner">
              Prioritas = nilai × umur hambatan × peluang selesai (asumsi:
              administratif 0,8; sengketa 0,3; tidak diketahui 0,2). Pengingat
              hanya pada hari kerja AP; hari ini Minggu, sehingga penyusunan
              pengingat tercatat ditahan.
            </div>
            <section className="card">
              <h2>Antrean tindakan</h2>
              {table(
                [...open]
                  .filter(
                    (i) =>
                      !i.blockers.some(
                        (h) =>
                          h.category === "kemungkinan_likuiditas" &&
                          actionable(h),
                      ),
                  )
                  .sort((a, b) => score(b) - score(a)),
              )}
            </section>
            <section className="card">
              <h2>Indikasi likuiditas · keputusan bisnis</h2>
              <p className="muted">
                Pertimbangkan negosiasi atau jeda pesanan baru. Tidak dihitung
                sebagai hambatan yang dapat diselesaikan aplikasi.
              </p>
              {table(
                open.filter((i) =>
                  i.blockers.some(
                    (h) =>
                      h.category === "kemungkinan_likuiditas" && actionable(h),
                  ),
                ),
              )}
            </section>
          </>
        )}
        {page === menus[2] &&
          buyers.map((b) => (
            <ProfileForm
              key={`${b.id}-${JSON.stringify(b.profile)}-${JSON.stringify(b.contacts)}`}
              buyer={b}
              send={send}
            />
          ))}
        {selectedInvoice && page === "Detail invoice" && (
          <Detail
            key={selectedInvoice.id}
            i={selectedInvoice}
            b={buyers.find((b) => b.id === selectedInvoice.buyerId)!}
            send={send}
            notify={setNotice}
            busy={busy}
            links={db.links.filter((l) => l.invoiceId === selectedInvoice.id)}
          />
        )}
        {page === menus[3] && (
          <Audit rows={history} totals={totals} send={send} />
        )}
        {page === menus[4] && (
          <>
            <div className="banner">
              Simulasi kontrafaktual pada kumpulan historis yang sama, bukan
              hasil eksperimen. Asumsi pengurangan administratif: 40% / 65% hari
              dan 20% / 40% menit staf. Nilai pokok invoice tidak berkurang.
            </div>
            <section className="card">
              <h2>Perbandingan proses</h2>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mode</th>
                      <th>Hari tertahan</th>
                      <th>Nilai pernah tertahan</th>
                      <th>Menit staf</th>
                      <th>Biaya staf asumsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison(history, today).map((c) => (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td>{c.days.toFixed(1)}</td>
                        <td>{money(c.value)}</td>
                        <td>{c.minutes.toFixed(1)}</td>
                        <td>{money((c.minutes / 60) * config.staffHourly)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Sengketa, likuiditas, dan penyebab tidak diketahui:{" "}
                <strong>
                  {totals
                    .filter((x) => x.name !== "administratif")
                    .reduce((s, x) => s + x.invoiceDays, 0)}{" "}
                  hari-invoice tidak tersentuh
                </strong>{" "}
                oleh kedua simulasi.
              </p>
            </section>
            <section className="card">
              <h2>Pengukuran operasional</h2>
              <p>
                Lolos lengkap pengiriman pertama:{" "}
                {(m.firstComplete * 100).toFixed(1)}%. Waktu terbit sampai lunas
                rata-rata:{" "}
                {m.paid.length
                  ? (
                      m.paid.reduce((s, x) => s + x.days, 0) / m.paid.length
                    ).toFixed(1)
                  : "—"}{" "}
                hari.
              </p>
              <h3>Waktu penyelesaian per kategori</h3>
              {categories.map((c) => {
                const rows = m.resolution.filter((r) => r.category === c);
                return (
                  <p key={c}>
                    {labels[c]}:{" "}
                    {rows.length
                      ? `${(rows.reduce((s, r) => s + r.days, 0) / rows.length).toFixed(1)} hari (${rows.length} hambatan)`
                      : "belum ada penyelesaian terukur"}
                  </p>
                );
              })}
              <h3>Menit staf per invoice</h3>
              <div className="tablewrap">
                <table>
                  <tbody>
                    {m.minutes.map((x) => (
                      <tr key={x.id}>
                        <td>{invoices.find((i) => i.id === x.id)?.number}</td>
                        <td>{x.minutes} menit</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
        {page === menus[5] && (
          <Scenarios
            open={openInvoice}
            vendor={vendor}
            send={send}
            setVendor={setVendor}
            setPage={setPage}
          />
        )}
        <footer className="muted" style={{ fontSize: 11, margin: "30px 0" }}>
          Tagih Tuntas · Seluruh nilai, pola keterlambatan, dan proyeksi seed
          adalah asumsi. Ganti dengan audit nyata.
        </footer>
      </main>
    </div>
  );
}
function score(i: Invoice) {
  const h = i.blockers.filter((h) => actionable(h));
  return (
    i.value *
    Math.max(1, ...h.map((h) => days(h.opened, today))) *
    (h.some((h) => h.category === "nominal_dipersoalkan")
      ? config.resolutionChance.dispute
      : h.some((h) => h.category === "tidak_diketahui")
        ? config.resolutionChance.unknown
        : config.resolutionChance.administrative)
  );
}
function Stat({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="stat">
      <div className="overline">{title}</div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function ProfileForm({ buyer, send }: { buyer: Buyer; send: Send }) {
  const [p, setP] = useState<Profile>(buyer.profile),
    [contacts, setContacts] = useState<Contact[]>(buyer.contacts),
    [expanded, setExpanded] = useState(false);
  const field = (key: keyof Profile, value: unknown) =>
    setP({ ...p, [key]: value });
  return (
    <section className="card">
      <div className="row">
        <div>
          <h2>{buyer.name}</h2>
          <span className="muted">
            Termin {buyer.terms} hari · cut-off tanggal {buyer.profile.cutoff} ·
            bayar tanggal {buyer.profile.paymentDay}
          </span>
        </div>
        <button
          className="btn secondary small"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Tutup" : "Edit profil"}
        </button>
      </div>
      {expanded && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await send({
              action: "profile",
              id: buyer.id,
              profile: p,
              contacts,
            });
          }}
        >
          <div className="formgrid">
            <label>
              Dokumen wajib (pisahkan koma)
              <input
                value={p.required.join(",")}
                onChange={(e) =>
                  field(
                    "required",
                    e.target.value.split(",").map((x) => x.trim()),
                  )
                }
              />
            </label>
            <label>
              Pola nomor invoice (regex)
              <input
                value={p.numberPattern}
                onChange={(e) => field("numberPattern", e.target.value)}
              />
            </label>
            <label>
              Format berkas (pisahkan koma)
              <input
                value={p.extensions.join(",")}
                onChange={(e) =>
                  field(
                    "extensions",
                    e.target.value
                      .split(",")
                      .map((x) => x.trim().toLowerCase()),
                  )
                }
              />
            </label>
            <label>
              Ukuran maksimum MB
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={p.maxMB}
                onChange={(e) => field("maxMB", Number(e.target.value))}
              />
            </label>
            <label>
              Cut-off tanggal
              <input
                type="number"
                min="1"
                max="31"
                value={p.cutoff}
                onChange={(e) => field("cutoff", Number(e.target.value))}
              />
            </label>
            <label>
              Payment run tanggal
              <input
                type="number"
                min="1"
                max="31"
                value={p.paymentDay}
                onChange={(e) => field("paymentDay", Number(e.target.value))}
              />
            </label>
            <label>
              Hari tukar faktur (0 Minggu – 6 Sabtu)
              <input
                value={p.exchangeDays.join(",")}
                onChange={(e) =>
                  field("exchangeDays", e.target.value.split(",").map(Number))
                }
              />
            </label>
            <label>
              Hari kerja AP (0 Minggu – 6 Sabtu)
              <input
                value={p.financeDays.join(",")}
                onChange={(e) =>
                  field("financeDays", e.target.value.split(",").map(Number))
                }
              />
            </label>
            <label>
              Kanal penyerahan
              <input
                value={p.channel}
                onChange={(e) => field("channel", e.target.value)}
              />
            </label>
            <label>
              Catatan pengalaman
              <textarea
                value={p.notes}
                onChange={(e) => field("notes", e.target.value)}
              />
            </label>
          </div>
          <div className="actions">
            {(["requirePO", "stamp", "signature"] as const).map((k, n) => (
              <label className="check" key={k}>
                <input
                  type="checkbox"
                  checked={p[k]}
                  onChange={(e) => field(k, e.target.checked)}
                />
                {["Wajib nomor PO", "Wajib cap", "Wajib tanda tangan"][n]}
              </label>
            ))}
          </div>
          <h3>Kontak per peran</h3>
          {contacts.map((c, n) => (
            <div className="formgrid" key={c.id}>
              <label>
                {text(c.role)} · nama
                <input
                  value={c.name}
                  onChange={(e) =>
                    setContacts(
                      contacts.map((x, k) =>
                        k === n ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Kanal kontak
                <input
                  value={c.channel}
                  onChange={(e) =>
                    setContacts(
                      contacts.map((x, k) =>
                        k === n ? { ...x, channel: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
            </div>
          ))}
          <button className="btn">Simpan profil & periksa ulang invoice</button>
        </form>
      )}
    </section>
  );
}
function Detail({
  i,
  b,
  send,
  notify,
  busy,
  links,
}: {
  i: Invoice;
  b: Buyer;
  send: Send;
  notify: (s: string) => void;
  busy: boolean;
  links: DB["links"];
}) {
  const closed = ["dibayar", "dihapus_buku"].includes(i.status);
  const check = completeness(i, b),
    c = cycle(b, today, i.due);
  const [doc, setDoc] = useState<Partial<Doc>>({
      kind: b.profile.required[0],
      filename: "",
      mb: 1,
      verification: "belum",
      stamp: false,
      signature: false,
      poNumber: "",
      note: "",
    }),
    [minutes, setMinutes] = useState(5),
    [note, setNote] = useState(""),
    [url, setUrl] = useState(""),
    [date, setDate] = useState(c.payment),
    [scheduleNote, setScheduleNote] = useState(""),
    [agreedValue, setAgreedValue] = useState(i.value);
  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
      notify("Teks disalin. Tidak ada pesan yang dikirim otomatis.");
    } catch {
      notify("Salin teks secara manual dari kotak pesan.");
    }
  }
  return (
    <>
      <div className="stats">
        <Stat title="NILAI INVOICE" value={short(i.value)} note={b.name} />
        <Stat
          title="STATUS"
          value={status(i.status)}
          note={`Jatuh tempo ${i.due}`}
        />
        <Stat
          title="SIKLUS BERIKUTNYA"
          value={c.payment}
          note={`Cut-off ${c.cutoff}`}
        />
        <Stat
          title="MENIT STAF"
          value={String(i.activities.reduce((s, a) => s + a.minutes, 0))}
          note="Akumulasi log aktivitas"
        />
      </div>
      <section className="card">
        <h2>Dokumen vs syarat pembayaran</h2>
        <p className="muted">
          Simulasi unggahan: nama berkas dan metadata saja. Tidak ada isi
          dokumen yang dikirim.
        </p>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Dokumen wajib</th>
                <th>Berkas</th>
                <th>Hasil pemeriksaan</th>
              </tr>
            </thead>
            <tbody>
              {b.profile.required.map((k) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>
                    {i.docs.find((d) => d.kind === k)?.filename ||
                      "Belum diunggah"}
                  </td>
                  <td>
                    <span
                      className={`badge ${check.missing.includes(k) || check.invalid.some((x) => x.startsWith(k)) ? "warn" : ""}`}
                    >
                      {check.missing.includes(k)
                        ? "Kurang"
                        : check.invalid.some((x) => x.startsWith(k))
                          ? "Belum sesuai"
                          : "Cocok"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {check.invalid.map((s) => (
          <p key={s} className="muted">
            {s}
          </p>
        ))}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await send({
              action: "document",
              id: i.id,
              document: doc,
              minutes,
            });
          }}
        >
          <div className="formgrid">
            <label>
              Jenis dokumen
              <select
                value={doc.kind}
                onChange={(e) => setDoc({ ...doc, kind: e.target.value })}
              >
                {b.profile.required.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              Nama berkas
              <input
                required
                placeholder="faktur-pajak.pdf"
                value={doc.filename}
                onChange={(e) => setDoc({ ...doc, filename: e.target.value })}
              />
            </label>
            <label>
              Ukuran MB
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={doc.mb}
                onChange={(e) => setDoc({ ...doc, mb: Number(e.target.value) })}
              />
            </label>
            <label>
              Nomor PO
              <input
                value={doc.poNumber}
                onChange={(e) => setDoc({ ...doc, poNumber: e.target.value })}
              />
            </label>
            <label>
              Verifikasi vendor
              <select
                value={doc.verification}
                onChange={(e) =>
                  setDoc({
                    ...doc,
                    verification: e.target.value as Doc["verification"],
                  })
                }
              >
                <option value="belum">Belum diperiksa</option>
                <option value="cocok">Cocok, sudah diperiksa</option>
                <option value="tidak_cocok">Tidak cocok</option>
              </select>
            </label>
            <label>
              Menit staf
              <input
                type="number"
                min="0"
                max="1440"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="actions">
            <label className="check">
              <input
                type="checkbox"
                checked={doc.stamp}
                onChange={(e) => setDoc({ ...doc, stamp: e.target.checked })}
              />
              Ada cap
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={doc.signature}
                onChange={(e) =>
                  setDoc({ ...doc, signature: e.target.checked })
                }
              />
              Ada tanda tangan
            </label>
          </div>
          <button disabled={busy || closed} className="btn">
            Simpan / ganti metadata
          </button>
        </form>
        <div className="actions">
          <button
            className="btn secondary"
            disabled={busy || i.status !== "draft"}
            onClick={() => send({ action: "send", id: i.id, minutes })}
          >
            Periksa & tandai dikirim
          </button>
        </div>
      </section>
      <section className="card">
        <h2>Hambatan & tindakan berikutnya</h2>
        {i.blockers.map((h) => (
          <article
            key={h.id}
            className={`blocker ${h.category === "kemungkinan_likuiditas" ? "liquidity" : ""}`}
          >
            <div className="row">
              <h3>{labels[h.category]}</h3>
              <span className="badge">
                {h.invalidated ? "Indikasi ditarik" : status(h.status)}
              </span>
            </div>
            <p>
              Keyakinan {h.confidence} · {text(h.source)} · penanggung jawab:{" "}
              <strong>{text(h.owner)}</strong>
            </p>
            <p>Sinyal: {h.signals.join(" · ")}</p>
            <p>
              {h.nextAction} · tenggat {h.deadline}
            </p>
            {h.invalidated && <p>{h.invalidated}</p>}
            {actionable(h) && !closed && (
              <>
                <textarea
                  aria-label={`Pesan ${labels[h.category]}`}
                  readOnly
                  value={message(i, b, h, today)}
                />
                <div className="actions">
                  <button
                    className="btn small secondary"
                    onClick={() => copy(message(i, b, h, today))}
                  >
                    Salin teks
                  </button>
                  <button
                    className="btn small secondary"
                    disabled={busy || !cadence(i, b, h, today).allowed}
                    onClick={() =>
                      send({
                        action: "message",
                        id: i.id,
                        blockerId: h.id,
                        minutes,
                      })
                    }
                  >
                    Catat penyusunan pengingat
                  </button>
                  <button
                    className="btn small secondary"
                    disabled={busy || h.status !== "terbuka"}
                    onClick={() =>
                      send({ action: "waiting", id: i.id, blockerId: h.id })
                    }
                  >
                    Menunggu pihak lain
                  </button>
                  <button
                    className="btn small secondary"
                    disabled={
                      busy ||
                      !cadence(i, b, h, today).allowed ||
                      !cadence(i, b, h, today).escalate
                    }
                    onClick={() =>
                      send({
                        action: "escalate",
                        id: i.id,
                        blockerId: h.id,
                        minutes,
                      })
                    }
                  >
                    Eskalasi ke atasan
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
        {!i.blockers.length && <p>Belum ada hambatan terdeteksi.</p>}
        <div className="banner">
          Salin teks tersedia untuk peninjauan. Pencatatan pengingat mengikuti
          hari kerja AP dan jeda {config.reminderGapDays} hari. Eskalasi setelah{" "}
          {config.escalationDays} hari tanpa penyelesaian.
        </div>
      </section>
      <section className="card">
        <h2>Tautan pembeli tanpa akun</h2>
        {links.length > 0 && (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Aksi</th>
                  <th>Berlaku sampai</th>
                  <th>Status</th>
                  <th>Kelola</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id}>
                    <td>{l.action}</td>
                    <td>
                      {new Date(l.expires).toLocaleString("id-ID", {
                        timeZone: "Asia/Jakarta",
                      })}{" "}
                      WIB
                    </td>
                    <td>
                      {l.status === "aktif" &&
                      Date.parse(l.expires) <= Date.now()
                        ? "kedaluwarsa"
                        : l.status}
                    </td>
                    <td>
                      {l.status === "aktif" && (
                        <button
                          className="btn small secondary"
                          disabled={busy}
                          onClick={() =>
                            send({
                              action: "revokeLink",
                              id: i.id,
                              linkId: l.id,
                            })
                          }
                        >
                          Cabut tautan
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">
          Pilih satu aksi. Tautan berlaku 72 jam waktu nyata dan hanya untuk
          invoice ini.
        </p>
        <div className="actions">
          {(["penerimaan", "dokumen", "alasan", "nominal"] as const).map(
            (action) => (
              <button
                key={action}
                className="btn secondary"
                disabled={busy || closed}
                onClick={async () => {
                  const r = await send({
                    action: "link",
                    id: i.id,
                    buyerAction: action,
                  });
                  if (r?.url) setUrl(String(r.url));
                }}
              >
                Minta {action}
              </button>
            ),
          )}
        </div>
        {url && (
          <div className="banner">
            <a href={url} target="_blank" rel="noreferrer">
              Buka tampilan pembeli ↗
            </a>
            <div className="actions">
              <button
                className="btn small"
                onClick={() => copy(location.origin + url)}
              >
                Salin tautan
              </button>
            </div>
          </div>
        )}
      </section>
      <section className="card">
        <h2>Pencatatan pembayaran & aktivitas</h2>
        <label>
          Bukti konfirmasi jadwal dari AP
          <input
            value={scheduleNote}
            onChange={(e) => setScheduleNote(e.target.value)}
            placeholder="Nama kontak, tanggal konfirmasi, dan kesepakatan"
          />
        </label>
        <label>
          Tanggal siklus yang telah dikonfirmasi AP
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="actions">
          <button
            className="btn secondary"
            disabled={busy || closed}
            onClick={() =>
              send({
                action: "schedule",
                id: i.id,
                date,
                note: scheduleNote,
                minutes,
              })
            }
          >
            Tandai dijadwalkan bayar
          </button>
          <button
            className="btn secondary"
            disabled={busy || closed || i.status === "draft"}
            onClick={() => send({ action: "paid", id: i.id, minutes })}
          >
            Catat sudah lunas
          </button>
        </div>
        <label>
          Catatan telepon / tindak lanjut
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label>
          Menit staf
          <input
            type="number"
            min="0"
            max="1440"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        <button
          className="btn"
          disabled={busy || !note.trim()}
          onClick={() => send({ action: "log", id: i.id, note, minutes })}
        >
          Catat aktivitas
        </button>
        {i.dispute && (
          <>
            <label>
              Nominal disepakati bersama PO
              <input
                type="number"
                min="1"
                value={agreedValue}
                onChange={(e) => setAgreedValue(Number(e.target.value))}
              />
            </label>
            <button
              className="btn secondary"
              disabled={busy || !note.trim()}
              onClick={() =>
                send({
                  action: "resolveDispute",
                  id: i.id,
                  note,
                  minutes,
                  value: agreedValue,
                })
              }
            >
              Catat kesepakatan & selesaikan sengketa
            </button>
          </>
        )}
        {!i.approved && (
          <button
            className="btn secondary"
            disabled={busy || !note.trim()}
            onClick={() => send({ action: "approve", id: i.id, note, minutes })}
          >
            Catat bukti persetujuan
          </button>
        )}
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aktivitas</th>
                <th>Menit</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {[...i.activities].reverse().map((a) => (
                <tr key={a.id}>
                  <td>{a.time}</td>
                  <td>{text(a.kind)}</td>
                  <td>{a.minutes}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 160 }}>
                    {a.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function Audit({
  rows,
  totals,
  send,
}: {
  rows: DB["history"];
  totals: ReturnType<typeof audit>;
  send: Send;
}) {
  const [csv, setCsv] = useState(
    "pelanggan,nilai,tanggal_terbit,jatuh_tempo,tanggal_bayar,penyebab,menit_staf\nPT Contoh,15000000,2026-07-01,2026-08-01,2026-09-15,dokumen_kurang,45",
  );
  const sum = totals.reduce((s, x) => s + x.invoiceDays, 0),
    admin = totals.find((x) => x.name === "administratif")!,
    liquid = totals.find((x) => x.name === "likuiditas")!;
  return (
    <>
      <div className="banner">
        {liquid.invoiceDays > sum / 2
          ? "Sebagian besar keterlambatan adalah likuiditas. Potensi Tagih Tuntas terbatas untuk vendor ini."
          : "Peluang perbaikan hanya pada hambatan administratif; perlu validasi lewat audit nyata."}{" "}
        Klasifikasi manual rawan bias ingatan vendor.
      </div>
      <section className="card">
        <div className="row">
          <h2>Pembagian penyebab keterlambatan</h2>
          <button className="btn secondary" onClick={() => downloadCSV(rows)}>
            Ekspor CSV audit
          </button>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Penyebab</th>
                <th>Invoice</th>
                <th>Nilai pernah tertahan</th>
                <th>Hari-invoice</th>
                <th>Bagian hari</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((x) => (
                <tr key={x.name}>
                  <td>{text(x.name)}</td>
                  <td>{x.count}</td>
                  <td>{money(x.value)}</td>
                  <td>{x.invoiceDays}</td>
                  <td>{sum ? ((x.invoiceDays / sum) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Perkiraan hari yang mungkin dihindari oleh cek kelengkapan:{" "}
          <strong>
            {(admin.invoiceDays * config.completenessReduction).toFixed(1)}{" "}
            hari-invoice (
            {sum
              ? (
                  ((admin.invoiceDays * config.completenessReduction) / sum) *
                  100
                ).toFixed(1)
              : 0}
            %)
          </strong>
          . Asumsi, bukan janji hasil.
        </p>
      </section>
      <section className="card">
        <h2>Impor CSV historis</h2>
        <p className="muted">
          Tanggal YYYY-MM-DD, nilai Rupiah berupa angka tanpa pemisah. Tanggal
          bayar boleh kosong. Impor menambahkan data ke vendor aktif.
        </p>
        <label>
          Pilih berkas CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setCsv(await f.text());
            }}
          />
        </label>
        <label>
          Data CSV
          <textarea
            rows={6}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
        </label>
        <button className="btn" onClick={() => send({ action: "import", csv })}>
          Validasi & impor
        </button>
        <p className="muted">
          Kategori tersedia: {categories.join(", ")}. Gunakan tidak_diketahui
          jika belum memiliki bukti.
        </p>
      </section>
      <section className="card">
        <h2>Pemetaan penyebab per invoice</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Pelanggan</th>
                <th>Nilai</th>
                <th>Jatuh tempo</th>
                <th>Penyebab manual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.buyer}</td>
                  <td>{money(r.value)}</td>
                  <td>{r.due}</td>
                  <td>
                    <select
                      aria-label={`Penyebab ${r.id}`}
                      value={r.cause}
                      onChange={(e) =>
                        send({
                          action: "mapCause",
                          id: r.id,
                          cause: e.target.value,
                        })
                      }
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {labels[c]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function Scenarios({
  open,
  vendor,
  send,
  setVendor,
  setPage,
}: {
  open: (id: string) => void;
  vendor: string;
  send: Send;
  setVendor: (v: string) => void;
  setPage: (p: string) => void;
}) {
  const [result, setResult] = useState("");
  function run(n: number) {
    const db = seed();
    const i = db.invoices[n - 1],
      b = db.buyers.find((b) => b.id === i.buyerId)!,
      o = db.orders[n - 1];
    if (n === 1) {
      const before = completeness(i, b);
      i.docs.push({
        ...i.docs[0],
        id: "tax",
        kind: "Faktur pajak",
        filename: "faktur.pdf",
      });
      const after = completeness(i, b);
      setResult(
        `S1: sebelum unggah: ${before.missing.join(", ")} kurang. Setelah metadata cocok: ${after.complete ? "lengkap" : "belum lengkap"}. Jika lengkap 5 Oktober, pembayaran paling cepat ${cycle(b, "2026-10-05", i.due).payment}; masih dalam siklus Oktober.`,
      );
    } else if (n === 2)
      setResult(
        `S2: lewat cut-off: ${cycle(b, today, i.due).missed ? "ya" : "tidak"}; siklus pembayaran berikutnya ${cycle(b, today, i.due).payment}.`,
      );
    else if (n <= 6)
      setResult(
        `S${n}: ${diagnose(i, b, o, today)
          .map(
            (h) =>
              `${labels[h.category]} (${h.confidence}): ${h.signals.join("; ")}`,
          )
          .join(
            " | ",
          )}. Gunakan detail invoice untuk mencoba tautan dan perubahan data.`,
      );
    else if (n === 7) {
      const l = {
        id: "test",
        invoiceId: "test-invoice",
        contactId: "test",
        token: "test",
        expires: "2026-10-01",
        action: "penerimaan" as const,
        status: "aktif" as const,
      };
      const errors: string[] = [];
      for (const id of ["test-invoice", "invoice-lain"])
        try {
          validateToken(l, id, "2026-10-18");
        } catch (e) {
          errors.push((e as Error).message);
        }
      setResult(`S7: ${errors.join(" / ")}`);
    } else {
      setVendor("v5");
      setPage("Audit invoice lama");
    }
  }
  return (
    <>
      <section className="card">
        <h2>Delapan skenario siap dijalankan</h2>
        <p>
          Uji aturan memakai fixture terisolasi agar dapat diulang. Tombol
          detail membuka data tersimpan untuk mencoba unggahan dan tautan
          pembeli sungguhan.
        </p>
        {[
          "Dokumen kurang sebelum kirim",
          "Terlewat cut-off",
          "Konfirmasi penerimaan melalui tautan",
          "Pembeli mempersoalkan nominal",
          "Indikasi likuiditas",
          "Sinyal tidak cukup",
          "Token kedaluwarsa / salah invoice",
          "Audit dominan likuiditas",
        ].map((s, n) => (
          <div key={s} className="barrow row">
            <span>
              <strong>S{n + 1}</strong> · {s}
            </span>
            <div className="actions">
              <button className="btn small" onClick={() => run(n + 1)}>
                Jalankan
              </button>
              {n < 6 && (
                <button
                  className="btn small secondary"
                  onClick={() => open(`i${Number(vendor.slice(1)) - 1}-${n}`)}
                >
                  Detail
                </button>
              )}
            </div>
          </div>
        ))}
        {result && (
          <div role="status" className="banner">
            {result}
          </div>
        )}
      </section>
      <section className="card">
        <h2>Reset lingkungan demo</h2>
        <p>
          Menghapus perubahan lokal dan hasil impor, lalu membuat ulang seed.
          Unduh/salin data penting sebelum reset.
        </p>
        <button
          className="btn secondary"
          onClick={() => {
            if (window.confirm("Hapus perubahan lokal dan kembalikan seed?"))
              send({ action: "reset" });
          }}
        >
          Reset seluruh data demo
        </button>
      </section>
    </>
  );
}

function downloadCSV(rows: DB["history"]) {
  const url = URL.createObjectURL(
    new Blob([exportCSV(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `audit-tagih-tuntas-${today}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function NewInvoice({
  buyers,
  send,
  busy,
  done,
}: {
  buyers: Buyer[];
  send: Send;
  busy: boolean;
  done: (id: string) => void;
}) {
  const [buyerId, setBuyerId] = useState(buyers[0]?.id || ""),
    [number, setNumber] = useState(""),
    [value, setValue] = useState(""),
    [issued, setIssued] = useState(today);
  return (
    <form
      className="new-invoice"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await send({
          action: "createInvoice",
          buyerId,
          number,
          value: Number(value),
          issued,
        });
        if (result?.id) done(String(result.id));
      }}
    >
      <h3>Buat draft invoice</h3>
      <p className="muted">
        Jatuh tempo mengikuti termin pelanggan. Lengkapi dokumen dan persetujuan
        sebelum invoice dikirim.
      </p>
      <div className="formgrid">
        <label>
          Pelanggan
          <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {b.terms} hari
              </option>
            ))}
          </select>
        </label>
        <label>
          Nomor invoice baru
          <input
            required
            maxLength={100}
            value={number}
            placeholder="INV-2026-001"
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>
        <label>
          Nilai invoice (Rp)
          <input
            required
            type="number"
            min="1"
            step="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <label>
          Tanggal terbit
          <input
            required
            type="date"
            max={today}
            value={issued}
            onChange={(e) => setIssued(e.target.value)}
          />
        </label>
      </div>
      <button className="btn" disabled={busy}>
        Buat draft
      </button>
    </form>
  );
}
