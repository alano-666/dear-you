import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "致你 Dear You",
  description: "一个记得你生活的 AI,会给你写信",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fdfcfa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="flex min-h-full flex-col">
        <Nav />
        <main className="flex-1 pb-24 md:pb-20">{children}</main>
      </body>
    </html>
  );
}
