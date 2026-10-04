import type { Metadata } from "next";
import "@/app/styles.css";

export const metadata: Metadata = { title: "Friends Included Ltd", description: "Wedding Guests for Hire finance system" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
