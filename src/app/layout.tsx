import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextScene",
  description: "Personal movie recommendations, considered.",
};

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("nextscene-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
