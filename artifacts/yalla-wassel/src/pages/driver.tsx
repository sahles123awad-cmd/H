import { useEffect, useState } from "react";
import { DriverLayout } from "@/components/layout/driver-layout";
import { useAuth } from "@/hooks/useAuth";
import { useListOrders, useSetOrderEta } from "@workspace/api-client-react";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { getListOrdersQueryKey, getGetMeQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Phone, PackageOpen, CheckCircle, Clock, PhoneCall, XCircle, AlertTriangle, StickyNote, Calendar, Award, Sparkles, MessageSquare, TrendingUp, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EtaCountdown } from "@/components/eta-countdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const ETA_OPTIONS = [
  { label: "15 د", value: 15 }, { label: "30 د", value: 30 },
  { label: "45 د", value: 45 }, { label: "ساعة", value: 60 }, { label: "1.5", value: 90 },
];

const PRESET_MSGS = [
  "تحت الخدمة، أنا في الطريق إليك",
  "وصلت العنوان، أنا بانتظارك",
  "تأخرت بسبب الطريق، آسف",
  "هل تستطيع تحديد موقعك بدقة أكثر؟",
  "الطلب جاهز وأنا في الطريق",
];

const REJECT_REASONS = ["بعيد عن منطقتي", "مشغول حالياً", "خارج الدوام", "مشكلة في المركبة", "آخر"];
const PROBLEM_REASONS = ["العميل لا يرد", "العنوان غير صحيح", "البضاعة غير جاهزة", "مشكلة في الدفع", "آخر"];

export default function DriverDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useListOrders(undefined as any, { query: { refetchInterval: 15000 } as any } as any);
  const etaMutation = useSetOrderEta();

  const [rejectOrder, setRejectOrder] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOther, setRejectOther] = useState("");
  const [problemOrder, setProblemOrder] = useState<any>(null);
  const [problemReason, setProblemReason] = useState("");
  const [problemOther, setProblemOther] = useState("");
  const [noteOrder, setNoteOrder] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [dayOffOpen, setDayOffOpen] = useState(false);
  const [dayOffDate, setDayOffDate] = useState("");
  const [msgOpen, setMsgOpen] = useState(false);
  const [perfOpen, setPerfOpen] = useState(false);
  const [pointsData, setPointsData] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [perf, setPerf] = useState<any>(null);
  const [routeOpen, setRouteOpen] = useState(false);
  const [route, setRoute] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    api.getDriverPoints(user.id).then(setPointsData).catch(() => {});
    api.getDriverBadges(user.id).then(setBadges).catch(() => {});
  }, [user?.id]);

  const activeOrders = (orders || []).filter((o: any) =>
    o.driverId === user?.id && (o.status === "assigned" || o.status === "picked")
  );

  const deliveredToday = user && "deliveredToday" in user ? (user as any).deliveredToday : 0;
  const dailyGoal = (user as any)?.dailyGoal || 0;
  const assignedCount = activeOrders.length;

  const isSuspended = (user as any)?.status === "suspended";

  const handleStatusToggle = async (status: string) => {
    if (!user) return;
    try {
      await api.updateUserStatus(user.id, status);
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast.success("تم تحديث الحالة");
    } catch { toast.error("فشل تحديث الحالة"); }
  };

  const handleSetEta = (orderId: number, minutes: number) => {
    etaMutation.mutate({ id: orderId, data: { minutesFromNow: minutes } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        toast.success(`تم تحديد الوقت: ${minutes} دقيقة`);
      },
      onError: () => toast.error("فشل"),
    });
  };

  const handleUpdate = async (id: number, status: string) => {
    try {
      await api.updateOrderStatus(id, status);
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      if (status === "delivered") {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        if (user) api.getDriverPoints(user.id).then(setPointsData).catch(() => {});
      }
      toast.success(status === "picked" ? "تم الاستلام" : "تم التوصيل");
    } catch { toast.error("فشل"); }
  };

  const submitReject = async () => {
    const reason = rejectReason === "آخر" ? rejectOther : rejectReason;
    if (!reason || !rejectOrder) return;
    try {
      await api.rejectOrder(rejectOrder.id, reason);
      toast.success("تم رفض الطلب");
      setRejectOrder(null); setRejectReason(""); setRejectOther("");
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    } catch { toast.error("فشل الرفض"); }
  };

  const submitProblem = async () => {
    const reason = problemReason === "آخر" ? problemOther : problemReason;
    if (!reason || !problemOrder) return;
    try {
      await api.reportProblem(problemOrder.id, reason);
      toast.success("تم إبلاغ المدير");
      setProblemOrder(null); setProblemReason(""); setProblemOther("");
    } catch { toast.error("فشل الإبلاغ"); }
  };

  const submitNote = async () => {
    if (!noteText || !noteOrder) return;
    try {
      await api.setDriverNote(noteOrder.id, noteText);
      toast.success("تم حفظ الملاحظة");
      setNoteOrder(null); setNoteText("");
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    } catch { toast.error("فشل الحفظ"); }
  };

  const submitDayOff = async () => {
    if (!dayOffDate) return;
    try {
      await api.requestDayOff(dayOffDate);
      toast.success("تم إرسال طلب الإجازة، بانتظار موافقة المدير");
      setDayOffOpen(false); setDayOffDate("");
    } catch { toast.error("فشل"); }
  };

  const sendMsg = async (msg: string) => {
    try {
      await api.sendDriverMessage(msg, true);
      toast.success("تم إرسال الرسالة للمدير");
      setMsgOpen(false);
    } catch { toast.error("فشل"); }
  };

  const openPerf = async () => {
    setPerfOpen(true);
    try { setPerf(await api.myPerformance()); } catch { toast.error("فشل التحميل"); }
  };

  const openRoute = async () => {
    setRouteOpen(true);
    try { const r = await api.optimalRoute(); setRoute(r?.route || []); }
    catch { toast.error("فشل حساب المسار"); }
  };

  if (isSuspended) {
    return (
      <DriverLayout>
        <div className="p-6 text-center">
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-6">
            <XCircle className="h-14 w-14 text-destructive mx-auto mb-3" />
            <h2 className="text-xl font-bold text-destructive">حسابك موقوف مؤقتاً</h2>
            <p className="text-sm text-muted-foreground mt-2">يرجى مراجعة المدير لإعادة التفعيل.</p>
          </div>
        </div>
      </DriverLayout>
    );
  }

  return (
    <DriverLayout>
      <div className="p-4 space-y-5">
        {/* Header */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">أهلاً، {user?.fullName?.split(" ")[0]}</h1>
            <button onClick={() => setDayOffOpen(true)} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-primary">
              <Calendar className="h-3.5 w-3.5" /> طلب إجازة
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 bg-muted p-1 rounded-xl">
            <button onClick={() => handleStatusToggle("available")} className={`py-2 rounded-lg text-sm font-medium transition-all ${user?.status === "available" ? "bg-success text-white shadow-md" : "text-muted-foreground"}`}>متاح</button>
            <button onClick={() => handleStatusToggle("busy")} className={`py-2 rounded-lg text-sm font-medium transition-all ${user?.status === "busy" ? "bg-primary text-white shadow-md" : "text-muted-foreground"}`}>مشغول</button>
            <button onClick={() => handleStatusToggle("off")} className={`py-2 rounded-lg text-sm font-medium transition-all ${user?.status === "off" ? "bg-secondary text-white shadow-md" : "text-muted-foreground"}`}>خارج</button>
          </div>
        </div>

        {/* Daily Goal */}
        {dailyGoal > 0 && (
          <Card className="rounded-2xl border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">🎯 هدفك اليومي</span>
                <span className="text-sm font-bold">{deliveredToday} / {dailyGoal}</span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-l from-primary to-orange-400 transition-all" style={{ width: `${Math.min(100, (deliveredToday / dailyGoal) * 100)}%` }} />
              </div>
              {deliveredToday >= dailyGoal && <p className="text-xs text-success font-bold mt-2">🎉 أحسنت! تجاوزت هدفك اليومي</p>}
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border text-center">
            <span className="text-3xl font-black text-primary block">{assignedCount}</span>
            <span className="text-sm text-muted-foreground font-medium">طلبات حالية</span>
          </div>
          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border text-center">
            <span className="text-3xl font-black text-success block">{deliveredToday}</span>
            <span className="text-sm text-muted-foreground font-medium">تم اليوم</span>
          </div>
        </div>

        {/* Points & Badges */}
        {(pointsData || badges.length > 0) && (
          <Card className="rounded-2xl border-border bg-gradient-to-l from-yellow-50 to-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold flex items-center gap-2"><Award className="h-5 w-5 text-yellow-600" /> النقاط والشارات</span>
                <span className="text-2xl font-black text-primary">{pointsData?.total || 0} نقطة</span>
              </div>
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {badges.map(b => (
                    <Badge key={b.id} variant="outline" className="bg-white border-primary/30 text-primary">
                      {b.icon} {b.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={openRoute} className="bg-card border border-border rounded-xl p-3 text-center hover:border-primary transition-all">
            <Navigation className="h-5 w-5 mx-auto text-primary mb-1" />
            <span className="text-xs font-bold block">المسار الذكي</span>
          </button>
          <button onClick={openPerf} className="bg-card border border-border rounded-xl p-3 text-center hover:border-primary transition-all">
            <TrendingUp className="h-5 w-5 mx-auto text-success mb-1" />
            <span className="text-xs font-bold block">أدائي</span>
          </button>
          <button onClick={() => setMsgOpen(true)} className="bg-card border border-border rounded-xl p-3 text-center hover:border-primary transition-all">
            <MessageSquare className="h-5 w-5 mx-auto text-blue-600 mb-1" />
            <span className="text-xs font-bold block">للمدير</span>
          </button>
        </div>

        {/* Active Orders */}
        <div>
          <h2 className="font-bold text-lg mb-3 px-1">طلباتي</h2>
          <div className="space-y-4">
            {isLoading ? <Skeleton className="h-32 rounded-2xl" /> :
             activeOrders.length === 0 ? (
              <div className="text-center py-10 px-4 bg-card rounded-2xl border border-dashed">
                <PackageOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-bold">لا توجد طلبات حالية</h3>
                <p className="text-sm text-muted-foreground mt-1">غيّر حالتك إلى "متاح" لاستقبال الطلبات</p>
              </div>
            ) : (
              <AnimatePresence>
                {activeOrders.map((order: any) => (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <Card className={`rounded-2xl shadow-sm overflow-hidden ${order.priority === "urgent" ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-xs font-mono text-muted-foreground">{order.orderId}</span>
                            <h3 className="font-bold text-lg leading-tight mt-0.5">{order.toCustomerName}</h3>
                          </div>
                          {order.priority === "urgent" && <Badge className="bg-primary text-white">عاجل</Badge>}
                        </div>

                        <div className="space-y-3 mb-4">
                          <div className="flex items-start gap-3">
                            <div className="w-6 flex flex-col items-center mt-1">
                              <div className="w-2.5 h-2.5 rounded-full bg-border"></div>
                              <div className="w-0.5 h-6 bg-border my-1"></div>
                              <MapPin className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 space-y-3">
                              <div>
                                <p className="text-xs text-muted-foreground">الاستلام من</p>
                                <p className="font-medium text-sm">{order.fromBusiness}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">التوصيل إلى</p>
                                <p className="font-medium text-sm">{order.toZoneName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{order.toAddress}</p>
                                {order.customerNote && (
                                  <p className="text-xs bg-blue-50 text-blue-800 rounded px-2 py-1 mt-1">📝 من العميل: {order.customerNote}</p>
                                )}
                                {order.driverNote && (
                                  <p className="text-xs bg-yellow-50 text-yellow-800 rounded px-2 py-1 mt-1">📝 ملاحظتي: {order.driverNote}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ETA */}
                        <div className="mb-3">
                          {order.eta ? <EtaCountdown eta={order.eta} compact={false} /> : (
                            <div className="bg-muted rounded-xl p-3">
                              <p className="text-xs font-medium mb-2 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> حدد الوقت المتوقع</p>
                              <div className="flex flex-wrap gap-1.5">
                                {ETA_OPTIONS.map(opt => (
                                  <button key={opt.value} disabled={etaMutation.isPending} onClick={() => handleSetEta(order.id, opt.value)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-card border hover:border-primary hover:text-primary">
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action buttons row */}
                        <div className="flex gap-2 mb-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex-shrink-0 h-11 w-11 rounded-xl bg-muted flex items-center justify-center"><Phone className="h-5 w-5" /></button>
                            </PopoverTrigger>
                            <PopoverContent side="top" className="w-auto p-3" dir="rtl">
                              <p className="text-xs text-muted-foreground mb-2">رقم العميل</p>
                              <p className="font-mono font-bold text-base mb-3" dir="ltr">{order.toPhone}</p>
                              <button onClick={() => window.location.href = `tel:${order.toPhone}`} className="flex items-center justify-center gap-2 w-full h-9 rounded-lg bg-primary text-white text-sm font-bold">
                                <PhoneCall className="h-4 w-4" /> اتصل
                              </button>
                            </PopoverContent>
                          </Popover>

                          <button onClick={() => { setNoteOrder(order); setNoteText(order.driverNote || ""); }} className="flex-shrink-0 h-11 w-11 rounded-xl bg-muted flex items-center justify-center" title="ملاحظة">
                            <StickyNote className="h-5 w-5" />
                          </button>

                          {order.status === "assigned" ? (
                            <Button className="flex-1 h-11 rounded-xl font-bold bg-secondary hover:bg-secondary/90" onClick={() => handleUpdate(order.id, "picked")}>
                              استلمت
                            </Button>
                          ) : (
                            <Button className="flex-1 h-11 rounded-xl font-bold bg-success hover:bg-success/90" onClick={() => handleUpdate(order.id, "delivered")}>
                              <CheckCircle className="ml-2 h-5 w-5" /> توصيل
                            </Button>
                          )}
                        </div>

                        {/* Secondary actions */}
                        <div className="flex gap-2">
                          {order.status === "assigned" && (
                            <button onClick={() => setRejectOrder(order)} className="flex-1 h-9 rounded-lg border border-destructive/30 text-destructive text-xs font-bold flex items-center justify-center gap-1">
                              <XCircle className="h-4 w-4" /> رفض الطلب
                            </button>
                          )}
                          {order.status === "picked" && (
                            <button onClick={() => setProblemOrder(order)} className="flex-1 h-9 rounded-lg border border-yellow-500/40 text-yellow-700 text-xs font-bold flex items-center justify-center gap-1">
                              <AlertTriangle className="h-4 w-4" /> أبلغ عن مشكلة
                            </button>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Reject dialog */}
      <Dialog open={!!rejectOrder} onOpenChange={(o) => !o && setRejectOrder(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>سبب رفض الطلب</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {REJECT_REASONS.map(r => (
              <button key={r} onClick={() => setRejectReason(r)} className={`w-full text-right p-3 rounded-lg border ${rejectReason === r ? "border-primary bg-primary/5" : "border-border"}`}>{r}</button>
            ))}
            {rejectReason === "آخر" && <Input placeholder="السبب..." value={rejectOther} onChange={e => setRejectOther(e.target.value)} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOrder(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={submitReject} disabled={!rejectReason}>تأكيد الرفض</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Problem dialog */}
      <Dialog open={!!problemOrder} onOpenChange={(o) => !o && setProblemOrder(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>الإبلاغ عن مشكلة</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {PROBLEM_REASONS.map(r => (
              <button key={r} onClick={() => setProblemReason(r)} className={`w-full text-right p-3 rounded-lg border ${problemReason === r ? "border-primary bg-primary/5" : "border-border"}`}>{r}</button>
            ))}
            {problemReason === "آخر" && <Input placeholder="المشكلة..." value={problemOther} onChange={e => setProblemOther(e.target.value)} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProblemOrder(null)}>إلغاء</Button>
            <Button onClick={submitProblem} disabled={!problemReason}>إرسال</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note dialog */}
      <Dialog open={!!noteOrder} onOpenChange={(o) => !o && setNoteOrder(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>ملاحظة على الطلب</DialogTitle></DialogHeader>
          <Textarea placeholder="مثال: بناية رقم 5، شقة 3..." value={noteText} onChange={e => setNoteText(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOrder(null)}>إلغاء</Button>
            <Button onClick={submitNote}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day off dialog */}
      <Dialog open={dayOffOpen} onOpenChange={setDayOffOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>طلب يوم إجازة</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">اختر التاريخ. سيتم إرسال الطلب للمدير للموافقة.</p>
          <Input type="date" value={dayOffDate} onChange={e => setDayOffDate(e.target.value)} dir="ltr" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayOffOpen(false)}>إلغاء</Button>
            <Button onClick={submitDayOff} disabled={!dayOffDate}>إرسال الطلب</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Messages */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>رسالة سريعة للمدير</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {PRESET_MSGS.map(m => (
              <button key={m} onClick={() => sendMsg(m)} className="w-full text-right p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 text-sm">
                {m}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Performance */}
      <Dialog open={perfOpen} onOpenChange={setPerfOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader><DialogTitle>أدائي الشخصي</DialogTitle></DialogHeader>
          {!perf ? <Skeleton className="h-40" /> : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { l: "اليوم", v: perf.today },
                  { l: "الأسبوع", v: perf.week },
                  { l: "الشهر", v: perf.month },
                  { l: "إجمالي", v: perf.total },
                ].map(s => (
                  <div key={s.l} className="bg-muted rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{s.v}</p>
                    <p className="text-xs text-muted-foreground">{s.l}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gradient-to-l from-yellow-50 to-orange-50 rounded-xl p-3 text-center">
                <p className="text-sm font-bold">⭐ التقييم: {perf.avgRating || "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">معدل التوصيل: {perf.avgDeliveryMin || "—"} دقيقة</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Optimal Route */}
      <Dialog open={routeOpen} onOpenChange={setRouteOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader><DialogTitle><Sparkles className="inline h-5 w-5 text-primary ml-1" /> المسار الأمثل</DialogTitle></DialogHeader>
          {route.length === 0 ? <p className="text-center py-6 text-muted-foreground">لا توجد طلبات لحساب المسار</p> : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">رتّبت الطلبات بناءً على المنطقة الجغرافية والأولوية:</p>
              {route.map((o: any, i: number) => (
                <div key={o.id} className="flex items-center gap-3 p-3 border rounded-xl">
                  <div className="h-8 w-8 rounded-full bg-primary text-white font-bold flex items-center justify-center">{i + 1}</div>
                  <div className="flex-1">
                    <p className="font-bold text-sm">{o.toCustomerName}</p>
                    <p className="text-xs text-muted-foreground">{o.toZoneName}</p>
                  </div>
                  {o.priority === "urgent" && <Badge className="bg-primary">عاجل</Badge>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DriverLayout>
  );
}
