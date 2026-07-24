"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@smarthire/ui";

const navigationLinks = [
  { name: "Features", href: "/features" },
  { name: "About Us", href: "/about" },
  { name: "Contact", href: "/contact" },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200/40 dark:border-zinc-800/50 bg-white/70 dark:bg-[#030303]/70 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="h-5 w-5 text-white animate-pulse" />
          </div>
          <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Smart<span className="text-blue-600 dark:text-blue-500">Hire</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navigationLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/login">
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button
              variant="primary"
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 md:hidden"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#030303] px-6 py-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-3">
            {navigationLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-850">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full">
              <Button variant="outline" className="w-full justify-center">
                Sign In
              </Button>
            </Link>
            <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="w-full">
              <Button variant="primary" className="w-full justify-center bg-blue-600 text-white">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
