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
    default: "Vaani — Gaayan and Vaani Paath, together",
    template: "%s | Vaani",
  },
  description:
    "A gathering space for Sakhis to come together for Shree Hit Chaturasi Ji gaayan, pada gaayan, and shared Vaani paath.",
  applicationName: "Vaani",
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/icon", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
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
    title: "Vaani — Gaayan and Vaani Paath, together",
    description:
      "A gathering space for Sakhis to come together for Shree Hit Chaturasi Ji gaayan, pada gaayan, and shared Vaani paath.",
    url: canonicalSiteUrl,
    images: [
      {
        url: "/opengraph-image?v=20261125-brand01",
        width: 1200,
        height: 630,
        alt: "Vaani — a gathering space for Gaayan and Vaani Paath",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vaani — Gaayan and Vaani Paath, together",
    description:
      "A gathering space for Sakhis to come together for Shree Hit Chaturasi Ji gaayan, pada gaayan, and shared Vaani paath.",
    images: ["/opengraph-image?v=20261125-brand01"],
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
  themeColor: "#f5f2ec",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={[display.variable, sans.variable, serif.variable, mono.variable, "h-full antialiased"].join(" ")}>
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
