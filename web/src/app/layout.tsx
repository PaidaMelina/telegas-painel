import type { Metadata } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import PainelEntregas from "@/components/PainelEntregas";

const sora = Sora({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "TeleGás — Painel de Operações",
  description: "Painel operacional de pedidos e entregas TeleGás",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${sora.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full" style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch' }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
          {children}
        </div>
        <PainelEntregas />
      </body>
    </html>
  );
}
