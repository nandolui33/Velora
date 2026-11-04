import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Velora — Gestión de citas para belleza y bienestar",
  description:
    "SaaS multiempresa de agenda, reservas y recursos para negocios de belleza y bienestar.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
