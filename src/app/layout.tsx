import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionRealtimeRefresh from "@/components/session-realtime-refresh";

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
    "A quiet space for Sakhis to gather for Chaturasi Ji gaayan, pada gaayan, and Vaani paath.",
  applicationName: "Vaani",
  keywords: [
    "Vaani",
    "Sakhis",
    "Chaturasi Ji gaayan",
    "Pada gaayan",
    "Shree Harivansh",
    "Vaani paath",
  ],
  openGraph: {
    type: "website",
    siteName: "Vaani",
    title: "Vaani",
    description:
      "A quiet space for Sakhis to gather for Chaturasi Ji gaayan, pada gaayan, and Vaani paath.",
    url: "https://vaaniju.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vaani — A place for Sakhis to gather",
    description:
      "For Sakhis to gather for Chaturasi Ji gaayan, pada gaayan, and Vaani paath.",
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
        <SessionRealtimeRefresh />
        {children}
      </body>
    </html>
  );
}
