import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Cormorant_Garamond, Geist_Mono, Lora, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import FormPendingFeedback from "@/components/form-pending-feedback";
import ToastViewport from "@/components/toast-viewport";
import InteractionProvider from "@/components/interaction-provider";
import { canonicalSiteUrl, siteUrl } from "@/lib/site-url";

const display = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const sans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const serif = Lora({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const isPreview = process.env.VERCEL_ENV === "preview";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Vaani — A shared space for Gaayan & Paath",
    template: "%s | Vaani",
  },
  description:
    "A quiet space for Sakhis to gather for Shree Hit Chaturasi Ji gaayan and Vaani paath.",
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
    title: "Vaani — A shared space for Gaayan & Paath",
    description:
      "A quiet space for Sakhis to gather for Shree Hit Chaturasi Ji gaayan and Vaani paath.",
    url: canonicalSiteUrl,
    images: [
      {
        url: "/opengraph-image?v=20261123-brand03",
        width: 1200,
        height: 630,
        alt: "Vaani — A shared space for Gaayan and Paath",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vaani — A shared space for Gaayan & Paath",
    description:
      "A quiet space for Sakhis to gather for Shree Hit Chaturasi Ji gaayan and Vaani paath.",
    images: ["/opengraph-image?v=20261123-brand03"],
  },
  icons: {
    icon: [
      { url: "/icon.svg?v=20261123-brand03", type: "image/svg+xml", sizes: "any" },
      { url: "/pwa-icons/192", type: "image/png", sizes: "192x192" },
      { url: "/pwa-icons/512", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/icon.svg?v=20261123-brand03",
    apple: "/pwa-icons/180?v=20261123-brand03",
  },
  appleWebApp: {
    capable: true,
    title: "Vaani",
    statusBarStyle: "default",
  },
  robots: isPreview
    ? { index: false, follow: false, noarchive: true }
    : { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f6f3ee",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <InteractionProvider>
          <Suspense fallback={null}>
            <FormPendingFeedback />
          </Suspense>
          <ToastViewport />
          {children}
        </InteractionProvider>
      </body>
    </html>
  );
}
