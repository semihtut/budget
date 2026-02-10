import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-yellow-600 text-yellow-50 text-xs font-medium flex items-center justify-center gap-1.5 py-1.5 px-3">
      <WifiOff className="w-3.5 h-3.5" />
      Çevrimdışı modesiniz
    </div>
  );
}
