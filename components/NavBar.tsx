'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/advisory',      label: 'Advisory' },
  { href: '/programmes',    label: 'Programmes' },
  { href: '/organisations', label: 'Organisations' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="bg-[#212122] px-8 py-4 flex items-center justify-between">
      <img
        src="https://a.storyblok.com/f/286772795909088/8000x3334/3742fbab42/white-logo.png"
        alt="Forward Institute"
        className="h-7 w-auto"
      />
      <nav className="flex items-center gap-1">
        {links.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-1.5 rounded-full text-sm font-[Geist] transition-colors ${
                active
                  ? 'bg-[#ffcc12] text-[#212122] font-medium'
                  : 'text-[#fcf2e3] opacity-60 hover:opacity-100'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="text-[#fcf2e3] text-sm font-[Geist] opacity-40">
        FY 2026/27
      </p>
    </header>
  );
}
