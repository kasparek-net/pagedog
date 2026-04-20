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
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <Image src="/icon.svg" alt="" width={28} height={28} className="shrink-0" priority />
              Pagedog
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
      </body>
    </html>
  );
}
