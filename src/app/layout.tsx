import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aforo · Cotizador de patrocinios",
  description:
    "Cotizador de patrocinios para eventos en vivo en México: rango de precio sugerido con desglose por variable.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col bg-aforo-bg text-aforo-fg antialiased">
        {children}
      </body>
    </html>
  );
}
