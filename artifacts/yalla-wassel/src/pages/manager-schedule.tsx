import { useEffect, useState } from "react";
import { ManagerLayout } from "@/components/layout/manager-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useListDrivers } from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  working: "bg-green-500 text-white",
  off: "bg-red-500 text-white",
  sick: "bg-yellow-500 text-white",
};
const STATUS_LABELS: Record<string, string> = {
  working: "دوام", off: "إجازة", sick: "مرض",
};
const cycle = (s?: string) => s === "working" ? "off" : s === "off" ? "sick" : "working";

function getWeekDates(offset: number) {
  const today = new Date();
  today.setDate(today.getDate() + offset * 7);
  const day = today.getDay();
  const sunday = new Date(today); sunday.setDate(today.getDate() - day);
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(sunday); d.setDate(sunday.getDate() + i);
    return d;
  });
}
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const arabicDay = (d: Date) => ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"][d.getDay()];

export default function ManagerSchedule() {
  const [offset, setOffset] = useState(0);
  const week = getWeekDates(offset);
  const [schedule, setSchedule] = useState<Record<string, string>>({}); // key: driverId-date
  const [loading, setLoading] = useState(true);
  const [dayOffRequests, setDayOffRequests] = useState<any[]>([]);

  const { data: driversRaw } = useListDrivers();
  const drivers = (driversRaw || []).filter((d: any) => d.role === "driver");

  const load = async () => {
    setLoading(true);
    try {
      const start = fmt(week[0]); const end = fmt(week[6]);
      const [rows, dor] = await Promise.all([
        api.getSchedule(start, end),
        api.listDayOffRequests(),
      ]);
      const map: Record<string, string> = {};
      (rows || []).forEach((r: any) => { map[`${r.driverId}-${r.date}`] = r.status; });
      setSchedule(map);
      setDayOffRequests(dor || []);
    } catch { toast.error("فشل تحميل الجدول"); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [offset]);

  const setCell = async (driverId: number, date: string) => {
    const cur = schedule[`${driverId}-${date}`];
    const next = cycle(cur) as any;
    setSchedule(s => ({ ...s, [`${driverId}-${date}`]: next }));
    try {
      await api.setSchedule(driverId, date, next);
    } catch {
      toast.error("فشل التحديث");
      setSchedule(s => { const c = { ...s }; if (cur) c[`${driverId}-${date}`] = cur; else delete c[`${driverId}-${date}`]; return c; });
    }
  };

  const handleDayOff = async (id: number, status: "approved" | "rejected") => {
    try {
      await api.updateDayOff(id, status);
      toast.success(status === "approved" ? "تم الموافقة" : "تم الرفض");
      load();
    } catch { toast.error("فشل"); }
  };

  return (
    <ManagerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="h-6 w-6" /> جدول دوام السائقين</h1>
          <p className="text-muted-foreground mt-1">انقر على الخلية للتبديل بين: دوام → إجازة → مرض</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {week[0].toLocaleDateString("ar-EG")} — {week[6].toLocaleDateString("ar-EG")}
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => setOffset(o => o - 1)}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setOffset(0)}>الأسبوع الحالي</Button>
              <Button variant="outline" size="icon" onClick={() => setOffset(o => o + 1)}><ChevronLeft className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? <div className="p-6"><Skeleton className="h-40 w-full" /></div> : (
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-right p-3 font-bold sticky right-0 bg-muted/50">السائق</th>
                    {week.map((d, i) => (
                      <th key={i} className="text-center p-2 font-bold">
                        <div>{arabicDay(d)}</div>
                        <div className="text-xs text-muted-foreground">{d.getDate()}/{d.getMonth() + 1}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d: any) => (
                    <tr key={d.id} className="border-t">
                      <td className="p-3 font-medium sticky right-0 bg-card">{d.fullName}</td>
                      {week.map((day, i) => {
                        const dateStr = fmt(day);
                        const status = schedule[`${d.id}-${dateStr}`] || "working";
                        return (
                          <td key={i} className="text-center p-2">
                            <button
                              onClick={() => setCell(d.id, dateStr)}
                              className={`w-full py-2 rounded text-xs font-bold transition-all hover:scale-105 ${STATUS_COLORS[status]}`}
                            >
                              {STATUS_LABELS[status]}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Day off requests */}
        <Card>
          <CardHeader><CardTitle>طلبات الإجازة</CardTitle></CardHeader>
          <CardContent>
            {dayOffRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد طلبات إجازة</p>
            ) : (
              <div className="space-y-2">
                {dayOffRequests.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 border rounded-xl">
                    <div>
                      <p className="font-bold">{r.driverName}</p>
                      <p className="text-sm text-muted-foreground">التاريخ: {r.requestedDate}</p>
                    </div>
                    {r.status === "pending" ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleDayOff(r.id, "approved")} className="bg-success hover:bg-success/90">قبول</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDayOff(r.id, "rejected")}>رفض</Button>
                      </div>
                    ) : (
                      <span className={`text-sm font-bold ${r.status === "approved" ? "text-success" : "text-destructive"}`}>
                        {r.status === "approved" ? "✅ موافق عليه" : "❌ مرفوض"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
}
