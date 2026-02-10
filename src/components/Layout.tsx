import { NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Home, Camera, Wallet, ClipboardList, RefreshCw } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import OfflineBanner from "./OfflineBanner";

const tabs = [
  { to: "/", label: "Ana Sayfa", icon: Home },
  { to: "/scan", label: "Tara", icon: Camera },
  { to: "/subscriptions", label: "Abonelik", icon: RefreshCw },
  { to: "/budgets", label: "Bütçe", icon: Wallet },
  { to: "/history", label: "Geçmiş", icon: ClipboardList },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-900 text-white">
      <OfflineBanner />
      <main className="flex-1 overflow-y-auto main-content">
        <AnimatePresence mode="wait" initial={false}>
          <div key={location.pathname}>{children}</div>
        </AnimatePresence>
      </main>
      <nav
        aria-label="Ana navigasyon"
        className="tab-bar fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              `relative flex flex-col items-center py-3 px-4 min-w-[64px] text-xs transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset
              ${isActive ? "text-blue-400" : "text-slate-400"}`
            }
          >
            {({ isActive }) => (
              <>
                <tab.icon className="w-5 h-5 mb-0.5" aria-hidden="true" />
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-blue-400" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
