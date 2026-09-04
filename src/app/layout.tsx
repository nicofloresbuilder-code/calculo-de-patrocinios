import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell";
import { AuthzProvider } from "@/components/auth/AuthzProvider";
import { getAuthzContext } from "@/lib/auth/session";
import { visibleNavigation } from "@/lib/navigation";

// Una sola familia para toda la interfaz. El wordmark usa la serif del
// sistema (--font-display), que no cuesta descarga.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Aforo",
    template: "%s · Aforo",
  },
  description:
    "Plataforma interna de pricing de patrocinios para eventos en vivo en México.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Única lectura de sesión del render (la DAL la memoiza con React.cache).
  // De aquí salen tanto los módulos visibles como el contexto que baja al
  // cliente — no hay dos fuentes de verdad que se puedan desincronizar.
  const authz = await getAuthzContext();
  const sections = visibleNavigation(authz);

  return (
    <html lang="es" className={inter.variable}>
      <body className="bg-canvas text-fg">
        <AuthzProvider value={authz}>
          <AppShell sections={sections}>{children}</AppShell>
        </AuthzProvider>
      </body>
    </html>
  );
}
