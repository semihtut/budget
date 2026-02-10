import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

const tabs = [
  { to: "/", label: "Ana Sayfa", icon: "🏠" },
  { to: "/scan", label: "Tara", icon: "📷" },
  { to: "/budgets", label: "Bütçe", icon: "💰" },
  { to: "/history", label: "Geçmiş", icon: "📋" },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-[100dvh] bg-slate-900 text-white">
      <main className="flex-1 overflow-y-auto main-content">{children}</main>
      <nav className="tab-bar fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-3 text-xs transition-colors ${
                isActive ? "text-blue-400" : "text-slate-400"
              }`
            }
          >
            <span className="text-xl">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
