import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Sans_JP } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NetForge | 体験型ネットワーク学習プラットフォーム",
  description:
    "完全未経験からCCNA合格・実務レベルまでを一気通貫で学べる、イミュータブル仮想ネットワークエンジン搭載の体験型ネットワーク学習Webアプリ。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ja"
      className={`dark ${notoSansJp.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-[#070b14] text-slate-100 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
