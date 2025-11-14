import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/commons/Navbar";

export const metadata: Metadata = {
  title: "Inakat - Professional Talent Solutions",
  description: "Find the best professionals for your business",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
