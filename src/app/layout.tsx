import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { TempoInit } from "@/components/tempo-init";
import type { Metadata } from "next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stay Connected - Keep Your Loved Ones Safe",
  description: "Smart check-in reminders for your peace of mind. Get alerted if a loved one misses their routine check-in.",
  icons: {
    icon: '/ss_icon.png',
    shortcut: '/ss_icon.png',
    apple: '/ss_icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Script 
        src="https://api.tempolabs.ai/proxy-asset?url=https://storage.googleapis.com/tempo-public-assets/error-handling.js"
        strategy="lazyOnload"
      />
      <body className={inter.className}>
        {children}
        <TempoInit />
      </body>
    </html>
  );
}
