import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import Image from "next/image";
import { getSessionEmail } from "@/lib/session";
import { getTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pagedog",
  description: "Watches web pages for changes and emails you when they happen.",
  icons: {
    icon: [{ url: "/icon", type: "image/svg+xml" }],
    apple: [{ url: "/icon", type: "image/svg+xml" }],
  },
};

const NO_FLASH_SCRIPT =
  "(()=>{try{const m=document.cookie.match(/pd_theme=(light|dark|system)/);" +
  "const t=m?m[1]:'system';" +
  "const dark=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);" +
  "if(dark)document.documentElement.classList.add('dark');}catch(e){}})();";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [email, theme] = await Promise.all([getSessionEmail(), getTheme()]);
  const initialDark = theme === "dark";
  return (
    <html lang="en" className={`h-full antialiased${initialDark ? " dark" : ""}`}>
      <head>
        <Script id="theme-no-flash" strategy="beforeInteractive">
          {NO_FLASH_SCRIPT}
        </Script>
      </head>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 backdrop-blur sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link
              href="/"
              aria-label="Pagedog"
              className="flex items-center text-neutral-900 dark:text-neutral-100"
            >
              <Image src="/logo.svg" alt="Pagedog" width={135} height={44} className="h-9 w-auto" priority />
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              <ThemeToggle initialTheme={theme} />
              {email ? (
                <>
                  <Link
                    href="/watches/new"
                    className="rounded-md bg-brand text-black px-3 py-1.5 font-medium hover:bg-brand-dark"
                  >
                    New watch
                  </Link>
                  <span className="text-xs text-neutral-500 hidden sm:inline">
                    {email}
                  </span>
                  <form action="/api/auth/signout" method="post">
                    <button
                      type="submit"
                      className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:underline"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/sign-in" className="hover:underline">
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-neutral-200 dark:border-neutral-800 mt-8">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-center">
            <a
              href="https://github.com/kasparek-net/pagedog"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 .5C5.73.5.67 5.56.67 11.83c0 4.99 3.24 9.22 7.73 10.71.57.1.78-.24.78-.55v-1.93c-3.14.68-3.8-1.51-3.8-1.51-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .94-.3 3.08 1.16.89-.25 1.85-.37 2.8-.37.95 0 1.91.13 2.81.37 2.14-1.46 3.08-1.16 3.08-1.16.61 1.55.23 2.7.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.04.76 2.1v3.12c0 .31.21.66.79.55 4.48-1.49 7.72-5.72 7.72-10.71C23.33 5.56 18.27.5 12 .5z"/>
              </svg>
              kasparek-net/pagedog
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
