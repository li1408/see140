import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://li1408.github.io/see140/";
const title = "see140";
const description =
  "A webcam-based 3D gesture drawing canvas with hand tracking, calibration, zoom, gravity, and particle clearing effects.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "see140",
    "hand gesture",
    "whiteboard",
    "3D drawing",
    "MediaPipe",
    "Gesture Recognizer",
    "Next.js",
    "Three.js",
    "webcam",
    "real-time",
  ],
  authors: [{ name: "see140" }],
  creator: "see140",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title,
    description,
    siteName: "see140",
    images: [
      {
        url: `${siteUrl}og-image.png`,
        width: 1275,
        height: 766,
        alt: "see140 gesture drawing canvas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [`${siteUrl}og-image.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
