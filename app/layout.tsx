import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "../components/Sidebar"; // Memanggil komponen Sidebar yang baru dibuat

export const metadata: Metadata = {
  title: "Academic Intelligence Suite",
  description: "Student Performance Analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,300..800;1,300..800&family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,400..800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased flex min-h-screen bg-[#f8f9ff] font-sans">
        
        {/* Sidebar Kiri (Sekarang Dinamis) */}
        <Sidebar />

        {/* Konten Utama Kanan */}
        <div className="ml-64 flex-1 flex flex-col min-w-0">
          {children}
        </div>
        
      </body>
    </html>
  );
}