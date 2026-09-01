import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const THEME_BOOT = `(function(){try{var t=localStorage.getItem("rmp-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Rate My Pong",
  description: "Log matches and climb the ELO board.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} h-full`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <SiteNav />
        <main className="flex-1">{children}</main>
        <footer className="site-footer">
          <p>
            Created by Daniel Scrugham ·{" "}
            <a
              href="https://github.com/scrugham"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/scrugham
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
