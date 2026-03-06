"use client";

import { usePathname } from "next/navigation";

interface AppShellProps {
  email?: string | null;
  children: React.ReactNode;
}

const navLinks = [
  { href: "/tasks", label: "Home" },
  { href: "/today", label: "Today" },
  { href: "/daily-structure", label: "Daily Structure" },
  { href: "/settings", label: "Settings" },
];

export default function AppShell({ email, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen">
      <aside className="w-[200px] flex-shrink-0 flex flex-col h-screen sticky top-0 bg-white border-r border-gray-200">
        <div className="px-4 py-4">
          <span className="text-sm font-bold text-gray-900">TaskDump</span>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <a
                key={href}
                href={href}
                className={`block px-3 py-2 rounded text-sm transition-colors ${
                  isActive
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                {label}
              </a>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-gray-100 space-y-2">
          {email && (
            <p className="text-xs text-gray-400 truncate" title={email}>
              {email}
            </p>
          )}
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="text-xs text-gray-500 hover:text-gray-800 underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 overflow-auto bg-gray-50">
        {children}
      </div>
    </div>
  );
}
