import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "TagihTuntas · Piutang lebih jelas",
  description:
    "Kenali hambatan invoice, lengkapi persyaratan, arahkan tindakan.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
