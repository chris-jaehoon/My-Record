import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import ThemeToggle from "@/components/ThemeToggle";
import { SITE } from "@/lib/site";
import "./globals.css";

const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_ID?.trim() || undefined;
const googleVerification =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || undefined;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.author.name, url: SITE.author.url }],
  creator: SITE.author.name,
  publisher: SITE.author.name,
  keywords: [
    "AI 에이전트",
    "LLM 아키텍처",
    "SW 아키텍트",
    "소프트웨어 설계",
    "비용 비교",
    "일본 여행",
    "마운자로",
    "재훈의 노트",
  ],
  alternates: {
    canonical: `${SITE.url}/`,
  },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    url: `${SITE.url}/`,
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    images: [
      {
        url: `${SITE.url}/og.png`,
        width: 1200,
        height: 630,
        alt: SITE.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
    images: [`${SITE.url}/og.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  ...(googleVerification ? { verification: { google: googleVerification } } : {}),
  ...(adsenseId ? { other: { "google-adsense-account": adsenseId } } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1013" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={SITE.lang} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />

        {/* Google AdSense — loaded only when a publisher id is configured. */}
        {adsenseId ? (
          <Script
            id="adsense-init"
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
          />
        ) : null}

        <header className="site-header">
          <div className="container site-header__inner">
            <Link href="/" className="site-title">
              {SITE.name}
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="site-main">{children}</main>

        <footer className="site-footer">
          <div className="container site-footer__inner">
            <div className="site-footer__about">
              <p>
                © {new Date().getFullYear()} {SITE.author.name}
              </p>
              <p className="site-footer__note">
                100% 사람이 직접 쓰고 검증한 글 · AI 에이전트 조회용으로 구조화
                <span className="site-footer__en" lang="en">
                  {SITE.claim.badge}
                </span>
              </p>
            </div>
            <nav className="site-footer__links" aria-label="바깥 링크">
              <a href={`${SITE.basePath}/llms.txt`}>llms.txt</a>
              <a href={SITE.author.url} target="_blank" rel="noreferrer noopener">
                GitHub
              </a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
