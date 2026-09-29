import type { ReactNode } from "react";
import "./globals.css";

/**
 * Next.js root layout (app/layout.tsx).
 *
 * Vite build note: there is no server-rendered <html>/<head>/<body> here — index.html owns those and
 * loads the Poppins <link>, the favicon and the viewport meta. `metadata` below is kept in the Next.js
 * shape (it is applied at runtime by src/App.tsx via document.title) so this file can go back into a
 * Next.js project unchanged apart from restoring `import type { Metadata } from "next"`.
 */
export const metadata = {
  title: {
    default: "Clipping World - Cutout Studio",
    template: "%s",
  },
  description:
    "Remove image backgrounds in your browser, refine the cutout, replace the background, adjust colours, resize, add shadows, compress and export PNG, JPG or WebP.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0733eb" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh flex-col">{children}</div>;
}
