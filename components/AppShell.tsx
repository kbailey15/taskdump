"use client";

import { usePathname } from "next/navigation";

interface AppShellProps {
  email?: string | null;
  children: React.ReactNode;
}

const navLinks = [
  { href: "/today", label: "Today" },
  { href: "/week", label: "This Week" },
  { href: "/tasks", label: "All Tasks" },
  { href: "/goals", label: "Goals" },
];

export default function AppShell({ email, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen">
      <aside className="w-72 flex-shrink-0 flex flex-col h-screen sticky top-0" style={{ backgroundColor: "#1A1814" }}>
        {/* Logo */}
        <div className="px-6 py-6 flex items-center gap-2">
          <span
            className="text-xl text-white tracking-tight"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            KBLOS
          </span>
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: "#2A5C8C" }}
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <a
                key={href}
                href={href}
                className={`block px-3 py-2 rounded text-sm transition-colors ${
                  isActive
                    ? "bg-blue-900/20 text-blue-300 font-medium"
                    : "hover:bg-white/5"
                }`}
                style={isActive ? undefined : { color: "#9C9790" }}
              >
                {label}
              </a>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-5 space-y-4" style={{ borderTop: "1px solid #2A2720" }}>
          <p
            className="text-xs italic leading-snug"
            style={{ fontFamily: "'DM Serif Display', serif", color: "#9C9790" }}
          >
            &ldquo;Your eye is on Canada. Keep hiking.&rdquo;
          </p>
          {email && (
            <p className="text-xs truncate" style={{ color: "#9C9790" }} title={email}>
              {email}
            </p>
          )}
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="text-xs underline hover:text-white transition-colors"
              style={{ color: "#9C9790" }}
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
