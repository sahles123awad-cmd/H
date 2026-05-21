import { useEffect, useState } from "react";
import { ManagerLayout } from "@/components/layout/manager-layout";
import { 
  useGetDashboardStats, 
  useListOrders, 
  useListDrivers, 
  useSuggestDriver 
} from "@workspace/api-client-react";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { getListOrdersQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";
import { OrderLabelModal } from "@/components/order-label-modal";
import { AlertCircle, Archive, FileDown, QrCode, Link2, Inbox } from "lucide-react";
import * as XLSX from "xlsx";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, CheckCircle, Clock, RotateCcw, BrainCircuit, UserPlus, MapPin, Search, MoreVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function ManagerDashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({ query: { refetchInterval: 30000 } as any });
  
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  
  const { data: orders, isLoading: ordersLoading } = useListOrders(undefined as any, {
    query: { refetchInterval: 15000 } as any,
  } as any);

  const { data: drivers } = useListDrivers(undefined as any, { query: { enabled: true } as any } as any);

  const [showArchived, setShowArchived] = useState(false);
  const [labelOrder, setLabelOrder] = useState<any>(null);
  const [delayAlerts, setDelayAlerts] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [driverMessages, setDriverMessages] = useState<any[]>([]);
  const [inboxOpen, setInboxOpen] = useState(false);

  useEffect(() => {
    api.delayAlert().then(setDelayAlerts).catch(() => {});
    api.listComplaints().then((c: any[]) => setComplaints(c?.filter((x: any) => x.status === "pending") || [])).catch(() => {});
    api.listDriverMessages().then(setDriverMessages).catch(() => {});
    const i = setInterval(() => {
      api.delayAlert().then(setDelayAlerts).catch(() => {});
      api.listComplaints().then((c: any[]) => setComplaints(c?.filter((x: any) => x.status === "pending") || [])).catch(() => {});
      api.listDriverMessages().then(setDriverMessages).catch(() => {});
    }, 60 * 1000);
    return () => clearInterval(i);
  }, []);

  const filteredOrders = orders?.filter((o: any) => {
    if (showArchived !== !!o.isArchived) return false;
    if (statusFilter && o.status !== statusFilter) return false;
    if (search && !o.orderId.includes(search) && !o.toCustomerName.includes(search) && !(o.toPhone || "").includes(search)) return false;
    return true;
  });

  const copyTrackingLink = async (order: any) => {
    const url = `${window.location.origin}/track/${order.trackingToken}`;
    try { await navigator.clipboard.writeText(url); toast.success("تم نسخ رابط التتبع"); }
    catch { toast.error("فشل النسخ"); }
  };

  const archiveOrder = async (o: any) => {
    try {
      await (o.isArchived ? api.unarchiveOrder(o.id) : api.archiveOrder(o.id));
      toast.success(o.isArchived ? "تم استرجاع الطلب" : "تم أرشفة الطلب");
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    } catch { toast.error("فشل"); }
  };

  const repeatOrder = (o: any) => {
    sessionStorage.setItem("repeat_order", JSON.stringify({
      toCustomerName: o.toCustomerName, toPhone: o.toPhone, toAddress: o.toAddress,
      toZoneId: o.toZoneId, fromBusiness: o.fromBusiness, fromAddress: o.fromAddress,
    }));
    toast.success("تم نسخ بيانات الطلب — أنشئ طلباً جديداً للزبون");
  };

  const exportPDF = () => {
    if (!filteredOrders?.length) return;
    const statusAr: Record<string, string> = {
      pending: "قيد الانتظار", assigned: "تم التعيين", picked: "تم الاستلام",
      delivered: "تم التوصيل", cancelled: "ملغي", rejected: "مرفوض",
    };
    const rows = filteredOrders.map((o: any) => `
      <tr>
        <td>${o.orderId}</td>
        <td>${o.fromBusiness}</td>
        <td>${o.toCustomerName}</td>
        <td>${o.toPhone || "-"}</td>
        <td>${o.toZoneName || "-"}</td>
        <td>${statusAr[o.status] || o.status}</td>
        <td>${o.driverName || "-"}</td>
      </tr>`).join("");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>تقرير الطلبات</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color:#222; padding:24px; }
  h1 { color:#FF6B00; margin:0 0 4px; font-size:22px; }
  .sub { color:#666; font-size:13px; margin-bottom:16px; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th { background:#FF6B00; color:#fff; padding:8px; text-align:right; }
  td { padding:7px 8px; border-bottom:1px solid #eee; text-align:right; }
  tr:nth-child(even) td { background:#FAFAFA; }
  .noprint { position:fixed; top:12px; left:12px; background:#FF6B00; color:#fff; border:0; padding:10px 18px; border-radius:8px; font-weight:bold; cursor:pointer; }
  @media print { .noprint { display:none; } }
</style></head><body>
<button class="noprint" onclick="window.print()">طباعة / حفظ PDF</button>
<h1>يلا وصل — تقرير الطلبات</h1>
<div class="sub">التاريخ: ${new Date().toLocaleString("ar-JO")} — العدد: ${filteredOrders.length}</div>
<table>
  <thead><tr>
    <th>رقم الطلب</th><th>المتجر</th><th>الزبون</th><th>الهاتف</th>
    <th>المنطقة</th><th>الحالة</th><th>السائق</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<script>setTimeout(()=>window.print(), 400);</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("فعّل النوافذ المنبثقة"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  const exportExcel = () => {
    if (!filteredOrders?.length) return;
    const ws = XLSX.utils.json_to_sheet(filteredOrders.map((o: any) => ({
      "رقم الطلب": o.orderId, "المتجر": o.fromBusiness, "العميل": o.toCustomerName,
      "الهاتف": o.toPhone, "المنطقة": o.toZoneName, "الحالة": o.status, "السائق": o.driverName || "",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `orders-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const resolveComplaint = async (id: number) => {
    try { await api.resolveComplaint(id); toast.success("تم حل الشكوى"); setComplaints(c => c.filter(x => x.id !== id)); }
    catch { toast.error("فشل"); }
  };

  // Suggest Driver logic
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const suggestDriverMutation = useSuggestDriver();
  const [suggestedDriver, setSuggestedDriver] = useState<{driverId: number, driverName: string, reason: string} | null>(null);

  const handleSuggest = (orderId: number) => {
    setSelectedOrderId(orderId);
    setSuggestedDriver(null);
    setAiPanelOpen(true);
    suggestDriverMutation.mutate({ data: { orderId } }, {
      onSuccess: (data) => {
        setSuggestedDriver(data);
      },
      onError: () => {
        toast.error("فشل في الحصول على اقتراح");
        setAiPanelOpen(false);
      }
    });
  };

  const handleAssign = async (orderId: number, driverId: number) => {
    try {
      await api.assignOrderDriver(orderId, driverId);
      toast.success("تم تعيين السائق بنجاح");
      setAiPanelOpen(false);
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
    } catch (err: any) {
      let msg = "فشل تعيين السائق";
      try {
        const parsed = JSON.parse(err?.message || "{}");
        if (parsed?.error) msg = parsed.error;
      } catch {}
      toast.error(msg);
    }
  };

  const statusMap: Record<string, { label: string, color: string }> = {
    pending: { label: "قيد الانتظار", color: "bg-muted text-muted-foreground border-muted-foreground/20" },
    assigned: { label: "تم التعيين", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
    picked: { label: "تم الاستلام", color: "bg-accent/20 text-yellow-700 border-accent/30 dark:text-yellow-400" },
    delivered: { label: "تم التوصيل", color: "bg-success/10 text-success border-success/20" },
    cancelled: { label: "ملغي", color: "bg-destructive/10 text-destructive border-destructive/20" },
  };

  return (
    <ManagerLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">نظرة عامة</h1>
            <p className="text-muted-foreground mt-1">ملخص عمليات اليوم</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setInboxOpen(true)} className="relative">
            <Inbox className="h-4 w-4 ml-2" />
            صندوق الرسائل
            {(complaints.length + driverMessages.filter(m => !m.isRead).length) > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-white text-[10px] rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold">
                {complaints.length + driverMessages.filter(m => !m.isRead).length}
              </span>
            )}
          </Button>
        </div>

        {/* Delay alerts */}
        {delayAlerts.length > 0 && (
          <div className="bg-destructive/5 border border-destructive/30 rounded-2xl p-4">
            <p className="font-bold text-destructive flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4" /> {delayAlerts.length} تنبيه تأخير
            </p>
            <ul className="text-sm space-y-1">
              {delayAlerts.slice(0, 3).map(a => (
                <li key={a.id}>• <strong>{a.driverName}</strong> تأخر في {a.orderId}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm border-border overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30">
              <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي اليوم</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="pt-4">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{stats?.totalToday || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-success/5">
              <CardTitle className="text-sm font-medium text-muted-foreground">تم التوصيل</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent className="pt-4">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold text-success">{stats?.deliveredToday || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-blue-50 dark:bg-blue-900/10">
              <CardTitle className="text-sm font-medium text-muted-foreground">قيد التوصيل</CardTitle>
              <RotateCcw className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent className="pt-4">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats?.inProgress || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30">
              <CardTitle className="text-sm font-medium text-muted-foreground">قيد الانتظار</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-4">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold text-muted-foreground">{stats?.pending || 0}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Orders Table */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border bg-card">
            <div>
              <CardTitle className="text-lg">الطلبات الحديثة</CardTitle>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="relative w-48">
                <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث (رقم/اسم/هاتف)" className="pl-2 pr-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">جميع الحالات</option>
                <option value="pending">قيد الانتظار</option>
                <option value="assigned">تم التعيين</option>
                <option value="picked">تم الاستلام</option>
                <option value="delivered">تم التوصيل</option>
                <option value="cancelled">ملغي</option>
                <option value="rejected">مرفوض</option>
              </select>
              <Button variant={showArchived ? "default" : "outline"} size="sm" className="h-9" onClick={() => setShowArchived(s => !s)}>
                <Archive className="h-4 w-4 ml-1" /> {showArchived ? "نشط" : "أرشيف"}
              </Button>
              <Button variant="outline" size="sm" className="h-9" onClick={exportPDF}><FileDown className="h-4 w-4 ml-1" /> PDF</Button>
              <Button variant="outline" size="sm" className="h-9" onClick={exportExcel}><FileDown className="h-4 w-4 ml-1" /> Excel</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[100px] text-right font-bold">رقم الطلب</TableHead>
                  <TableHead className="text-right font-bold">المتجر</TableHead>
                  <TableHead className="text-right font-bold">العميل</TableHead>
                  <TableHead className="text-right font-bold">المنطقة</TableHead>
                  <TableHead className="text-right font-bold">الحالة</TableHead>
                  <TableHead className="text-right font-bold">السائق</TableHead>
                  <TableHead className="text-right font-bold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredOrders?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      لا توجد طلبات تطابق البحث
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders?.map((order) => (
                    <TableRow key={order.id} className={order.priority === 'urgent' ? 'border-r-4 border-r-primary bg-primary/5' : ''}>
                      <TableCell className="font-mono text-xs">{order.orderId}</TableCell>
                      <TableCell className="font-medium">
                        {order.fromBusiness}
                        {order.priority === 'urgent' && (
                          <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20 mr-2 text-[10px] px-1 h-4">عاجل</Badge>
                        )}
                      </TableCell>
                      <TableCell>{order.toCustomerName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {order.toZoneName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusMap[order.status]?.color || ''}>
                          {statusMap[order.status]?.label || order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.driverName ? (
                          <span className="text-sm font-medium">{order.driverName}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">لم يعين بعد</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center">
                          {order.status === 'pending' && (
                            <Button size="sm" variant="default" className="h-8 px-2 text-xs" onClick={() => handleSuggest(order.id)}>
                              <BrainCircuit className="ml-1 h-3 w-3" /> اقتراح
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setLabelOrder(order)}>
                                <QrCode className="h-4 w-4 ml-2" /> طباعة ملصق/QR
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyTrackingLink(order)}>
                                <Link2 className="h-4 w-4 ml-2" /> نسخ رابط التتبع
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => repeatOrder(order)}>
                                <RotateCcw className="h-4 w-4 ml-2" /> إعادة الطلب
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => archiveOrder(order)}>
                                <Archive className="h-4 w-4 ml-2" /> {(order as any).isArchived ? "استرجاع" : "أرشفة"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={aiPanelOpen} onOpenChange={setAiPanelOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-primary" />
              اقتراح السائق الذكي
            </DialogTitle>
          </DialogHeader>
          <div className="py-6">
            {suggestDriverMutation.isPending ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-4">
                <div className="relative">
                  <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-ping"></div>
                  <div className="h-12 w-12 rounded-full border-4 border-t-primary border-r-primary border-b-transparent border-l-transparent animate-spin"></div>
                </div>
                <p className="text-muted-foreground animate-pulse">جاري تحليل البيانات واختيار أفضل سائق...</p>
              </div>
            ) : suggestedDriver ? (
              <div className="space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                  <div className="mx-auto h-12 w-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">{suggestedDriver.driverName}</h3>
                  <p className="text-sm text-muted-foreground bg-background p-3 rounded-lg mt-3 border border-border">
                    {suggestedDriver.reason}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter className="sm:justify-between flex-row">
            <Button type="button" variant="outline" onClick={() => setAiPanelOpen(false)}>
              إلغاء
            </Button>
            {suggestedDriver && (
              <Button type="button" onClick={() => selectedOrderId && handleAssign(selectedOrderId, suggestedDriver.driverId)}>
                تأكيد التعيين
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderLabelModal open={!!labelOrder} onOpenChange={(o) => !o && setLabelOrder(null)} order={labelOrder} />

      {/* Inbox dialog */}
      <Dialog open={inboxOpen} onOpenChange={setInboxOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader><DialogTitle>صندوق الرسائل والشكاوى</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {complaints.length === 0 && driverMessages.length === 0 && (
              <p className="text-center text-muted-foreground py-6 text-sm">لا توجد رسائل</p>
            )}
            {complaints.length > 0 && (
              <div>
                <p className="font-bold text-sm text-destructive mb-2">شكاوى العملاء ({complaints.length})</p>
                {complaints.map(c => (
                  <div key={c.id} className="border border-destructive/30 bg-destructive/5 rounded-lg p-3 mb-2">
                    <p className="font-bold text-sm">{c.reason}</p>
                    {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                    <p className="text-xs mt-1">📞 {c.customerPhone}</p>
                    <Button size="sm" variant="outline" onClick={() => resolveComplaint(c.id)} className="mt-2 h-7 text-xs">حل المشكلة</Button>
                  </div>
                ))}
              </div>
            )}
            {driverMessages.length > 0 && (
              <div>
                <p className="font-bold text-sm mb-2">رسائل السائقين</p>
                {driverMessages.slice(0, 20).map(m => (
                  <div key={m.id} className="border rounded-lg p-3 mb-2 bg-card">
                    <p className="text-sm">{m.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">— {m.driverName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ManagerLayout>
  );
}
