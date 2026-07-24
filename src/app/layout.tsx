import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { SiteHeader } from "../components/site-header";
import { Toaster } from "../components/toast/toaster";
import { siteUrl } from "../lib/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "In House Mixers — what can I make?",
  description:
    "Build your bar and instantly see which cocktails you can Mix from what you have In House.",
};

// Runs synchronously during HTML parsing, before first paint, so an explicit
// light/dark choice applies with no flash. A "system" (or absent) cookie adds
// no class and the prefers-color-scheme media query in globals.css takes over.
const themeInitScript = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=(light|dark)/);if(m)document.documentElement.classList.add(m[1])}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The theme script may add a light/dark class before React hydrates.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}