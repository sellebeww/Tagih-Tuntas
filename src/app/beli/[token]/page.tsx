"use client";
import { use, useEffect, useState } from "react";
import { categories } from "@/core/csv";
import { labels } from "@/core/engine";
export default function BuyerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<{
      number: string;
      value: number;
      action: string;
      required: string[];
    }>(),
    [invoiceId, setInvoiceId] = useState(""),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [note, setNote] = useState(""),
    [confirm, setConfirm] = useState(false),
    [category, setCategory] = useState("tidak_diketahui"),
    [kind, setKind] = useState(""),
    [filename, setFilename] = useState(""),
    [mb, setMB] = useState(1),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("invoice") || "";
    setInvoiceId(id);
    fetch(
      `/api/buyer?token=${encodeURIComponent(token)}&invoice=${encodeURIComponent(id)}`,
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
        setKind(d.required[0]);
      })
      .catch((e) => setError(e.message));
  }, [token]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/buyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          invoiceId,
          note,
          confirm,
          category,
          kind,
          filename,
          mb,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="buyer">
      <img
        className="buyer-logo"
        src="/logo.png"
        alt="TagihTuntas"
        width={150}
        height={102}
      />
      <section className="card">
        {done ? (
          <>
            <h1>Terima kasih.</h1>
            <p>
              Jawaban Anda sudah dicatat dan hambatan invoice diperbarui. Tautan
              ini kini tidak dapat digunakan kembali.
            </p>
          </>
        ) : (
          <>
            {error && (
              <div role="alert" className="banner">
                {error}
              </div>
            )}
            {data ? (
              <>
                <div className="overline">Satu invoice · satu tindakan</div>
                <h1 style={{ marginTop: 14 }}>
                  {
                    (
                      {
                        penerimaan: "Konfirmasi penerimaan",
                        dokumen: "Lengkapi dokumen",
                        alasan: "Apa alasan tertahan?",
                        nominal: "Laporkan selisih nominal",
                      } as Record<string, string>
                    )[data.action]
                  }
                </h1>
                <p>
                  {data.number} ·{" "}
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  }).format(data.value)}
                </p>
                <form onSubmit={submit}>
                  {data.action === "penerimaan" && (
                    <label className="check">
                      <input
                        type="checkbox"
                        required
                        checked={confirm}
                        onChange={(e) => setConfirm(e.target.checked)}
                      />
                      Saya mengonfirmasi barang/jasa sudah diterima.
                    </label>
                  )}
                  {data.action === "alasan" && (
                    <label>
                      Alasan tertahan
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {labels[c]}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {data.action === "dokumen" && (
                    <>
                      <div className="banner">
                        Simulasi metadata: jangan unggah isi dokumen asli.
                        Vendor akan memverifikasi metadata ini.
                      </div>
                      <label>
                        Jenis dokumen
                        <select
                          value={kind}
                          onChange={(e) => setKind(e.target.value)}
                        >
                          {data.required.map((k) => (
                            <option key={k}>{k}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Nama berkas
                        <input
                          required
                          value={filename}
                          onChange={(e) => setFilename(e.target.value)}
                        />
                      </label>
                      <label>
                        Ukuran MB
                        <input
                          required
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={mb}
                          onChange={(e) => setMB(Number(e.target.value))}
                        />
                      </label>
                    </>
                  )}
                  <label>
                    Catatan{" "}
                    {["alasan", "nominal"].includes(data.action)
                      ? "(wajib)"
                      : "(opsional)"}
                    <textarea
                      required={["alasan", "nominal"].includes(data.action)}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <button className="btn" disabled={busy}>
                    {busy ? "Menyimpan…" : "Kirim jawaban"}
                  </button>
                </form>
              </>
            ) : (
              !error && <p>Memeriksa tautan…</p>
            )}
          </>
        )}
      </section>
      <p className="muted">
        Tidak perlu akun. Tautan hanya mengizinkan tindakan yang diminta untuk
        invoice ini.
      </p>
    </main>
  );
}
