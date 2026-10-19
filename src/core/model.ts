export type Category =
  | "dokumen_kurang"
  | "dokumen_tidak_sesuai_format"
  | "penerimaan_belum_dikonfirmasi"
  | "nominal_dipersoalkan"
  | "menunggu_persetujuan_internal"
  | "terlewat_siklus_bayar"
  | "kemungkinan_likuiditas"
  | "tidak_diketahui";
export type Role =
  "vendor" | "pengadaan" | "penerima_barang" | "keuangan_ap" | "atasan";
export type InvoiceStatus =
  | "draft"
  | "dikirim"
  | "diterima_pembeli"
  | "tertahan"
  | "dijadwalkan_bayar"
  | "dibayar"
  | "disengketakan"
  | "dihapus_buku";
export interface Vendor {
  id: string;
  name: string;
}
export interface Contact {
  id: string;
  name: string;
  role: Role;
  channel: string;
}
export interface Profile {
  required: string[];
  numberPattern: string;
  requirePO: boolean;
  maxMB: number;
  extensions: string[];
  stamp: boolean;
  signature: boolean;
  exchangeDays: number[];
  financeDays: number[];
  cutoff: number;
  paymentDay: number;
  channel: string;
  notes: string;
}
export interface Buyer {
  id: string;
  vendorId: string;
  name: string;
  terms: number;
  profile: Profile;
  contacts: Contact[];
  lateRate: number;
}
export interface Order {
  id: string;
  vendorId: string;
  buyerId: string;
  value: number;
  date: string;
  receipts: string[];
}
export interface Doc {
  id: string;
  kind: string;
  filename: string;
  uploadedBy: string;
  time: string;
  verification: "belum" | "cocok" | "tidak_cocok";
  note: string;
  mb: number;
  stamp: boolean;
  signature: boolean;
  poNumber: string;
}
export interface Blocker {
  id: string;
  invoiceId: string;
  category: Category;
  source: "aturan" | "dilaporkan_pembeli" | "diisi_vendor";
  confidence: "tinggi" | "sedang" | "rendah";
  owner: Role;
  nextAction: string;
  deadline: string;
  status:
    "terbuka" | "menunggu_pihak_lain" | "selesai" | "tidak_bisa_diselesaikan";
  opened: string;
  closed?: string;
  signals: string[];
  invalidated?: string;
}
export interface Activity {
  id: string;
  invoiceId: string;
  kind:
    | "pesan_disusun"
    | "dokumen_diunggah"
    | "konfirmasi_pembeli"
    | "telepon_dicatat"
    | "eskalasi";
  time: string;
  minutes: number;
  note: string;
}
export interface Invoice {
  id: string;
  orderId: string;
  vendorId: string;
  buyerId: string;
  number: string;
  issued: string;
  due: string;
  value: number;
  status: InvoiceStatus;
  paid?: string;
  docs: Doc[];
  received: boolean;
  dispute: string;
  approved: boolean;
  scheduled?: string;
  submittedAt?: string;
  firstComplete?: boolean;
  blockers: Blocker[];
  activities: Activity[];
  cause: Category;
  scenario?: string;
}
export type BuyerAction = "penerimaan" | "dokumen" | "alasan" | "nominal";
export interface BuyerLink {
  id: string;
  invoiceId: string;
  contactId: string;
  token: string;
  expires: string;
  action: BuyerAction;
  status: "aktif" | "digunakan" | "dicabut";
}
export interface Historical {
  id: string;
  vendorId: string;
  buyer: string;
  value: number;
  issued: string;
  due: string;
  paid?: string;
  cause: Category;
  minutes: number;
}
export interface DB {
  vendors: Vendor[];
  buyers: Buyer[];
  orders: Order[];
  invoices: Invoice[];
  links: BuyerLink[];
  history: Historical[];
}
