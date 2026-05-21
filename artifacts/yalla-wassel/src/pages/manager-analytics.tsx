import { useEffect, useState } from "react";
import { ManagerLayout } from "@/components/layout/manager-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
  CartesianGrid,
} from "recharts";
import { Trophy, TrendingUp, AlertTriangle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

export default function ManagerAnalytics() {
  const [comparison, setComparison] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState<any[]>([]);
  const [cancellation, setCancellation] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [delayAlerts, setDelayAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>("today");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [a, c, d, e, f] = await Promise.all([
        api.driverComparison(), api.peakHours(),
        api.cancellationStats(), api.revenue(), api.delayAlert(),
      ]);
      setComparison(a || []);
      setPeakHours((c || []).map((r: any) => ({ hour: `${r.hour}:00`, count: Number(r.count) })));
      setCancellation(d);
      setRevenue(e);
      setDelayAlerts(f || []);
    } catch (err) {
      toast.error("فشل تحميل التحليلات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); const i = setInterval(loadAll, 5 * 60 * 1000); return () => clearInterval(i); }, []);

  const sorted = [...comparison].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
  const topId = sorted[0]?.driverId;

  return (
    <ManagerLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">التحليلات والإحصائيات</h1>
            <p className="text-muted-foreground mt-1">رؤى متقدمة لأداء النظام</p>
          </div>
          <Button onClick={loadAll} variant="outline" size="sm" disabled={loading}>
            <RefreshCcw className={`h-4 w-4 ml-2 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>

        {/* Delay alerts */}
        {delayAlerts.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="font-bold text-destructive">⚠️ تنبيهات تأخير</p>
              </div>
              <ul className="space-y-1 text-sm">
                {delayAlerts.map(a => (
                  <li key={a.id}>
                    <span className="font-bold">{a.driverName}</span> تأخر في طلب {a.orderId} منذ أكثر من 45 دقيقة
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Revenue */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            الإيرادات محسوبة بناءً على: أجرة أساسية 2.50 د.أ (عاجل: 4.00) + 1.00 د.أ بين المناطق + 0.50 د.أ للطلبات المجدولة
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "إيرادات اليوم", value: revenue?.today, count: revenue?.todayOrders, color: "text-primary" },
              { label: "إيرادات الأسبوع", value: revenue?.week, count: revenue?.weekOrders, color: "text-success" },
              { label: "إيرادات الشهر", value: revenue?.month, count: revenue?.monthOrders, color: "text-blue-600" },
              { label: "متوسط قيمة الطلب", value: revenue?.avgOrderValue, count: null, color: "text-muted-foreground" },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  {loading ? <Skeleton className="h-8 w-24 mt-2" /> : (
                    <>
                      <p className={`text-2xl md:text-3xl font-bold mt-2 ${s.color}`}>
                        {Number(s.value || 0).toFixed(2)} <span className="text-sm">د.أ</span>
                      </p>
                      {s.count !== null && (
                        <p className="text-xs text-muted-foreground mt-1">{s.count || 0} طلب</p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Revenue Trend */}
        {revenue?.trend?.length > 0 && (
          <Card>
            <CardHeader><CardTitle>اتجاه الإيرادات (آخر 30 يوم)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={revenue.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#FF6B00" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Peak Hours */}
        <Card>
          <CardHeader><CardTitle>ساعات الذروة (آخر أسبوع)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={peakHours}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#FF6B00" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cancellation */}
        {cancellation && (
          <Card>
            <CardHeader>
              <CardTitle>الإلغاءات (آخر 30 يوم)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">معدل الإلغاء</p>
                  <p className="text-3xl font-bold text-destructive">{cancellation.rate}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الملغية</p>
                  <p className="text-2xl font-bold">{cancellation.cancelled}</p>
                </div>
              </div>
              {cancellation.reasons?.length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={cancellation.reasons.map((r: any) => ({ reason: r.reason, count: Number(r.count) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="reason" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Driver Comparison */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>مقارنة أداء السائقين</CardTitle>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="h-9 text-sm rounded-md border px-2">
              <option value="today">ترتيب: اليوم</option>
              <option value="week">ترتيب: الأسبوع</option>
              <option value="month">ترتيب: الشهر</option>
              <option value="avgRating">ترتيب: التقييم</option>
              <option value="completionRate">ترتيب: نسبة الإنجاز</option>
            </select>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-right p-3 font-bold">السائق</th>
                    <th className="text-center p-3 font-bold">اليوم</th>
                    <th className="text-center p-3 font-bold">الأسبوع</th>
                    <th className="text-center p-3 font-bold">الشهر</th>
                    <th className="text-center p-3 font-bold">التقييم</th>
                    <th className="text-center p-3 font-bold">الإنجاز</th>
                    <th className="text-center p-3 font-bold">الأسرع</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(d => (
                    <tr key={d.driverId} className={`border-t ${d.driverId === topId ? "bg-primary/5" : ""}`}>
                      <td className="p-3 font-medium">
                        {d.driverId === topId && <Trophy className="inline h-4 w-4 text-yellow-500 ml-1" />}
                        {d.driverName}
                      </td>
                      <td className="text-center p-3">{d.today}</td>
                      <td className="text-center p-3">{d.week}</td>
                      <td className="text-center p-3">{d.month}</td>
                      <td className="text-center p-3">⭐ {d.avgRating}</td>
                      <td className="text-center p-3">{d.completionRate}%</td>
                      <td className="text-center p-3 text-muted-foreground">{d.fastestMin ? `${d.fastestMin}د` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
}
