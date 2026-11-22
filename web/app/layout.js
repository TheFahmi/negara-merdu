import Script from "next/script";
import "./globals.css";

/* Head yang sama dengan index.html lama: judul, deskripsi, manifest PWA,
   ikon, dan meta mobile. CSS global = style.css lama apa adanya. */
export const metadata = {
  title: "Negara Merdu",
  description:
    "Jalan-jalan di Negara Merdu, negara 3D low-poly yang warganya adalah follower @negaramerdu. Daftar jadi warga negara, dapat rumah dan Kartu Warga Negara.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/ikon-192.png", apple: "/ikon-180.png" },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Negara Merdu",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#86C2F0",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        {/* three.min.js vendored — dimuat sebelum kode game (global THREE),
            sama seperti <script src="three.min.js"> di index.html lama. */}
        <Script src="/three.min.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
