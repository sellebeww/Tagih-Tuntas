import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Tagih Tuntas · Piutang lebih jelas",
  description:
    "Kenali hambatan invoice, lengkapi persyaratan, arahkan tindakan.",
  // Private local workspace; buyer token pages must never be indexed.
  robots: { index: false, follow: false },
  authors: [{ name: "Vassel Goleyu" }],
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
