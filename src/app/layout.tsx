import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Bridge-code",
  description: "Bridge-code by ForvalCrossGear+",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased bg-white text-gray-900 overflow-x-hidden">{children}</body>
    </html>
  );
}
