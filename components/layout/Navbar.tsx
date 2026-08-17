"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <header className="border-b border-slate-800 bg-slate-950">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="text-xl font-bold text-white">
          AFRMS
        </Link>

        <nav className="flex items-center gap-8 text-sm">
          <Link href="/" className="text-slate-300 hover:text-white">
            Home
          </Link>

          <Link href="/map" className="text-slate-300 hover:text-white">
            Flood Map
          </Link>

          <Link href="/about" className="text-slate-300 hover:text-white">
            About
          </Link>

          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
}