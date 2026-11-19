import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const sans = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vaaniju.vercel.app"),
  title: {
    default: "Vaani",
    template: "%s | Vaani",
  },
  description:
    "Vaani is a place for Sakhis of the Radha Vallabh Sampradaya to gather for Chaturasi Ji gaayan, pada gaayan, and shared Vaani reading.",
  applicationName: "Vaani",
  keywords: [
    "Vaani",
    "Sakhis",
    "Chaturasi Ji gaayan",
    "Pada gaayan",
    "devotional reading",
    "community gatherings",
  ],
  openGraph: {
    type: "website",
    siteName: "Vaani",
    title: "Vaani",
    description:
      "Gather for Chaturasi Ji gaayan, pada gaayan, and shared Vaani reading.",
    url: "https://vaaniju.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vaani — A home for devotion and togetherness",
    description:
      "For Sakhis of the Radha Vallabh Sampradaya.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f8f5f0",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
