import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskDump",
  description: "Paste freeform tasks, get structured records",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
