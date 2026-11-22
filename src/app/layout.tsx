import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Cormorant_Garamond, Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
import FormPendingFeedback from "@/components/form-pending-feedback";
import ToastViewport from "@/components/toast-viewport";

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
    default: "Vaani — Sakhi Sang for Gaayan & Paath",
    template: "%s | Vaani",
  },
  description:
    "A place for Sakhis to come together for Shree Hit Chaturasi Ji gaayan, pada gaayan, and shared Vaani paath.",
  applicationName: "Vaani",
  keywords: [
    "Vaani",
    "Sakhi Sang",
    "Shree Hit Chaturasi Ji",
    "Sakhis",
    "Chaturasi Ji gaayan",
    "Pada gaayan",
    "Shree Harivansh",
    "Vaani paath",
  ],
  openGraph: {
    type: "website",
    siteName: "Vaani",
    title: "Vaani — Sakhi Sang for Gaayan & Paath",
    description:
      "A place for Sakhis to come together for Shree Hit Chaturasi Ji gaayan, pada gaayan, and shared Vaani paath.",
    url: "https://vaaniju.vercel.app",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Vaani — Sakhi Sang for Gaayan and Paath" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vaani — Sakhi Sang for Gaayan & Paath",
    description:
      "A place for Sakhis to come together for Shree Hit Chaturasi Ji gaayan, pada gaayan, and shared Vaani paath.",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/pwa-icons/192", type: "image/png", sizes: "192x192" },
      { url: "/pwa-icons/512", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/icon.svg",
    apple: "/pwa-icons/180",
  },
  appleWebApp: {
    capable: true,
    title: "Vaani",
    statusBarStyle: "default",
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
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}><FormPendingFeedback /></Suspense>
        <ToastViewport />
        {children}
      </body>
    </html>
  );
}
