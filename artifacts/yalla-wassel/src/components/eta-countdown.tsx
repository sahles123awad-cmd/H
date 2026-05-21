import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, AlertTriangle } from "lucide-react";

interface EtaCountdownProps {
  eta: string | null | undefined;
  delivered?: boolean;
  compact?: boolean;
}

function getTimeLeft(eta: string): { minutes: number; seconds: number; late: boolean; totalSeconds: number } {
  const diff = new Date(eta).getTime() - Date.now();
  const late = diff < 0;
  const abs = Math.abs(diff);
  return {
    minutes: Math.floor(abs / 60000),
    seconds: Math.floor((abs % 60000) / 1000),
    late,
    totalSeconds: Math.floor(abs / 1000),
  };
}

export function EtaCountdown({ eta, delivered, compact }: EtaCountdownProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!eta || delivered) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [eta, delivered]);

  if (!eta) return null;

  const { minutes, seconds, late } = getTimeLeft(eta);
  const etaDate = new Date(eta);
  const etaTime = etaDate.toLocaleTimeString("ar-JO", { hour: "2-digit", minute: "2-digit", hour12: true });

  if (delivered) {
    return (
      <div className={`flex items-center gap-2 text-green-600 ${compact ? "text-xs" : "text-sm"}`}>
        <Clock className={compact ? "h-3 w-3" : "h-4 w-4"} />
        <span>تم التسليم في الوقت المحدد</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${late ? "bg-red-100 text-red-600" : "bg-orange-100 text-primary"}`}>
        {late ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
        {late
          ? `متأخر ${minutes}:${String(seconds).padStart(2, "0")}`
          : `${minutes}:${String(seconds).padStart(2, "0")}`}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={late ? "late" : "ok"}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`rounded-xl p-3 flex items-center gap-3 ${late ? "bg-red-50 border border-red-200" : "bg-orange-50 border border-primary/20"}`}
      >
        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${late ? "bg-red-100" : "bg-primary/10"}`}>
          {late
            ? <AlertTriangle className="h-5 w-5 text-red-500" />
            : <Clock className="h-5 w-5 text-primary" />}
        </div>
        <div className="flex-1">
          <p className={`text-xs font-medium mb-0.5 ${late ? "text-red-500" : "text-muted-foreground"}`}>
            {late ? "⚠️ تجاوز الوقت المحدد!" : "الوقت المتوقع للوصول"}
          </p>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black tabular-nums ${late ? "text-red-600" : "text-primary"}`}>
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
            <span className={`text-xs ${late ? "text-red-400" : "text-muted-foreground"}`}>
              {late ? "تأخير" : `الساعة ${etaTime}`}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
