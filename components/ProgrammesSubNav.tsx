'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Sub-tabs under the Programmes section. Fellowship lives here rather than as a
// top-level nav item, since it's one of the programmes.
const tabs = [
  { href: '/programmes', label: 'Overview' },
  { href: '/programmes/fellowship', label: 'Fellowship' },
];

export default function ProgrammesSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden text-sm font-[Geist] w-fit">
      {tabs.map(({ href, label }) => {
        const active = href === '/programmes' ? pathname === '/programmes' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`px-4 py-1.5 transition-colors ${
              active ? 'bg-[#212122] text-[#fcf2e3]' : 'text-[#8a7a6a] hover:bg-[#f5ebe0]'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
