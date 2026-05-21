import { useRoute, useLocation } from "wouter";
import { useTrackOrder, useCreateRating } from "@workspace/api-client-react";
import { CustomerLayout } from "@/components/layout/customer-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Star, Package, MapPin, CheckCircle2, Clock, UserCircle, ArrowRight, Share2, AlertCircle, MessageSquareWarning, Download, MapIcon, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { EtaCountdown } from "@/components/eta-countdown";
import { MapView } from "@/components/map-view";
import { api } from "@/lib/api";

const STEPS = [
  { id: "pending",   label: "تم استلام الطلب",     sub: "الطلب وصلنا وجاري التجهيز" },
  { id: "assigned",  label: "تم تعيين السائق",      sub: "السائق في طريقه لاستلام الطلب" },
  { id: "picked",    label: "السائق استلم الطلب",   sub: "الطلب في الطريق إليك" },
  { id: "delivered", label: "تم التسليم",           sub: "وصل الطلب بنجاح" },
];
const stepIndex = (status: string) => STEPS.findIndex((s) => s.id === status);

const COMPLAINT_REASONS = ["تأخر التوصيل", "سوء معاملة السائق", "ضرر في الطلب", "طلب ناقص", "آخر"];

export default function CustomerTrack() {
  const [, params] = useRoute("/customer/track/:token");
  const [, setLocation] = useLocation();
  const token = params?.token ?? "";

  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [rated, setRated] = useState(false);
  const [speedStars, setSpeedStars] = useState(5);
  const [honestyStars, setHonestyStars] = useState(5);
  const [kindnessStars, setKindnessStars] = useState(5);

  const [showMap, setShowMap] = useState(true);
  const [thankSent, setThankSent] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrText, setAddrText] = useState("");
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintReason, setComplaintReason] = useState("");
  const [complaintOther, setComplaintOther] = useState("");
  const [complaintDesc, setComplaintDesc] = useState("");

  const [lastStatus, setLastStatus] = useState<string>("");
  const [notifPermAsked, setNotifPermAsked] = useState(false);

  const { data: order, isLoading, refetch } = useTrackOrder(token, {
    query: {
      enabled: !!token,
      refetchInterval: (query: any) => {
        const status = query?.state?.data?.status;
        return status === "delivered" || status === "cancelled" ? false : 20000;
      },
    } as any,
  });

  const ratingMutation = useCreateRating();

  // Ask for browser notification permission on first load
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default" && !notifPermAsked) {
      Notification.requestPermission().finally(() => setNotifPermAsked(true));
    }
  }, [notifPermAsked]);

  // Show browser notification on status change
  useEffect(() => {
    if (!order) return;
    if (lastStatus && lastStatus !== order.status && typeof Notification !== "undefined" && Notification.permission === "granted") {
      const msgs: Record<string, string> = {
        assigned: "تم تعيين سائق لطلبك",
        picked: "السائق استلم طلبك وهو في الطريق",
        delivered: "وصل طلبك بنجاح",
      };
      const msg = msgs[order.status];
      if (msg) new Notification("يلا وصل", { body: msg });
    }
    setLastStatus(order.status);
  }, [order?.status]);

  const submitRating = () => {
    ratingMutation.mutate(
      { data: { orderId: 0, driverId: 0, customerName: order?.toCustomerName ?? "زبون", stars: rating, comment } },
      {
        onSuccess: async (res: any) => {
          if (res?.id) {
            try { await api.saveDetailedRating(res.id, { speedStars, honestyStars, kindnessStars }); } catch {}
          }
          toast.success("شكراً لتقييمك! رأيك يهمنا.");
          setRated(true);
          refetch();
        },
        onError: () => { toast.success("شكراً لتقييمك!"); setRated(true); },
      }
    );
  };

  const sharePage = async () => {
    const url = window.location.href;
    const text = `تتبع طلبي من يلا وصل: ${order?.orderId}`;
    if (navigator.share) {
      try { await navigator.share({ title: "يلا وصل", text, url }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(url); toast.success("تم نسخ الرابط"); }
      catch { toast.error("فشل النسخ"); }
    }
  };

  const sendThanks = async () => {
    if (!order) return;
    try {
      await api.sendDriverMessage(`شكر من العميل ${order.toCustomerName} للطلب ${order.orderId}`, false);
      toast.success("تم إرسال الشكر للسائق ❤️");
      setThankSent(true);
    } catch { toast.error("فشل"); }
  };

  const submitNote = async () => {
    if (!order || !noteText) return;
    try {
      await api.setCustomerNote((order as any).id, noteText, token);
      toast.success("تم حفظ الملاحظة");
      setNoteOpen(false); setNoteText(""); refetch();
    } catch { toast.error("فشل"); }
  };

  const submitAddrChange = async () => {
    if (!order || !addrText) return;
    try {
      await api.changeAddress((order as any).id, addrText, token);
      toast.success("تم تغيير العنوان");
      setAddrOpen(false); setAddrText(""); refetch();
    } catch { toast.error("فشل (لا يمكن التغيير بعد استلام السائق)"); }
  };

  const submitComplaint = async () => {
    const reason = complaintReason === "آخر" ? complaintOther : complaintReason;
    if (!order || !reason) return;
    try {
      await api.fileComplaint({ orderId: (order as any).id, customerPhone: (order as any).toPhone, reason, description: complaintDesc });
      toast.success("تم استلام شكواك، سنتواصل معك قريباً");
      setComplaintOpen(false); setComplaintReason(""); setComplaintOther(""); setComplaintDesc("");
    } catch { toast.error("فشل"); }
  };

  const downloadInvoice = () => {
    if (!order) return;
    const o: any = order;
    const fee = Number(o.deliveryFee || 0).toFixed(2);
    const date = new Date(o.createdAt || Date.now()).toLocaleString("ar-JO");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>فاتورة ${o.orderId}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color:#222; margin:0; padding:24px; }
  .header { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #FF6B00; padding-bottom:16px; margin-bottom:24px; }
  .brand { font-size:28px; font-weight:900; color:#FF6B00; }
  .brand small { display:block; color:#666; font-size:13px; font-weight:400; margin-top:4px; }
  .meta { text-align:left; font-size:13px; color:#666; }
  h2 { color:#FF6B00; font-size:18px; margin:16px 0 8px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  td { padding:10px 8px; border-bottom:1px solid #eee; font-size:14px; }
  td:first-child { color:#666; width:35%; }
  td:last-child { font-weight:600; }
  .total { background:#FFF4EB; font-size:18px; font-weight:900; color:#FF6B00; }
  .footer { margin-top:32px; padding-top:16px; border-top:1px solid #eee; text-align:center; color:#888; font-size:12px; }
  .noprint { position:fixed; top:12px; left:12px; background:#FF6B00; color:#fff; border:0; padding:10px 18px; border-radius:8px; font-weight:bold; cursor:pointer; }
  @media print { .noprint { display:none; } }
</style></head><body>
<button class="noprint" onclick="window.print()">طباعة / حفظ PDF</button>
<div class="header">
  <div class="brand">يلا وصل<small>Yalla Wassel — خدمة التوصيل</small></div>
  <div class="meta">رقم الفاتورة<br><strong style="color:#222">${o.orderId}</strong><br>${date}</div>
</div>
<h2>تفاصيل الطلب</h2>
<table>
  <tr><td>الزبون</td><td>${o.toCustomerName}</td></tr>
  <tr><td>الهاتف</td><td>${o.toPhone || "-"}</td></tr>
  <tr><td>من</td><td>${o.fromBusiness}</td></tr>
  <tr><td>إلى</td><td>${o.toAddress || "-"}</td></tr>
  <tr><td>المنطقة</td><td>${o.toZoneName || "-"}</td></tr>
  <tr><td>السائق</td><td>${o.driverName || "-"}</td></tr>
  <tr><td>الحالة</td><td>تم التسليم</td></tr>
  <tr class="total"><td>أجرة التوصيل</td><td>${fee} د.أ</td></tr>
</table>
<div class="footer">شكراً لاستخدامك يلا وصل ❤️</div>
<script>setTimeout(()=>window.print(), 400);</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("فعّل النوافذ المنبثقة لتنزيل الفاتورة"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  const current = order ? stepIndex(order.status) : -1;
  const canChangeAddr = order && (order.status === "pending" || order.status === "assigned");
  const canPostpone = order && order.status === "pending";

  return (
    <CustomerLayout>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/customer/orders")} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs text-muted-foreground">تتبع طلبك</p>
            {order && <p className="font-mono font-bold text-sm">{order.orderId}</p>}
          </div>
        </div>
        {order && (
          <button onClick={sharePage} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center" title="مشاركة">
            <Share2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      )}

      {!token && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <Package className="h-12 w-12 text-muted-foreground/30" />
          <p className="font-bold text-lg">رابط التتبع غير صحيح</p>
        </div>
      )}

      {!isLoading && token && !order && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <Package className="h-12 w-12 text-muted-foreground/30" />
          <p className="font-bold text-lg">الطلب غير موجود</p>
        </div>
      )}

      {!isLoading && order?.status === "cancelled" && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center">
            <Package className="h-10 w-10 text-destructive" />
          </div>
          <p className="font-bold text-xl text-destructive">تم إلغاء الطلب</p>
          {(order as any).cancelReason && <p className="text-sm text-muted-foreground">السبب: {(order as any).cancelReason}</p>}
          <Button variant="outline" onClick={() => setLocation("/customer/orders")}>العودة للطلبات</Button>
        </div>
      )}

      {!isLoading && order && order.status !== "cancelled" && (
        <div className="space-y-4">
          {order.eta && order.status !== "delivered" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <EtaCountdown eta={order.eta} delivered={false} />
            </motion.div>
          )}

          {/* From → To */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">من</p>
                <p className="font-bold">{order.fromBusiness}</p>
              </div>
            </div>
            <div className="border-r-2 border-dashed border-border h-4 mr-4" />
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-secondary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">إلى</p>
                <p className="font-bold">{order.toCustomerName}</p>
                {order.toAddress && <p className="text-sm text-muted-foreground mt-0.5">{order.toAddress}</p>}
                {order.toZoneName && <p className="text-xs text-muted-foreground mt-0.5">📍 {order.toZoneName}</p>}
                {canChangeAddr && (
                  <button onClick={() => { setAddrText(order.toAddress || ""); setAddrOpen(true); }} className="text-xs text-primary font-bold mt-2 flex items-center gap-1">
                    <Pencil className="h-3 w-3" /> تعديل العنوان
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Map */}
          {order.status !== "delivered" && (
            <div className="space-y-2">
              <button onClick={() => setShowMap(s => !s)} className="text-sm font-bold flex items-center gap-2">
                <MapIcon className="h-4 w-4" /> {showMap ? "إخفاء" : "عرض"} الخريطة
              </button>
              {showMap && (
                <MapView
                  fromLabel={order.fromBusiness}
                  toLabel={order.toAddress || order.toCustomerName}
                  driverLabel={order.driverName || null}
                />
              )}
            </div>
          )}

          {/* Steps */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className="relative">
              <div className="absolute top-5 bottom-5 right-[18px] w-0.5 bg-border" />
              <motion.div className="absolute top-5 right-[18px] w-0.5 bg-primary origin-top"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: current >= 0 ? current / (STEPS.length - 1) : 0 }}
                transition={{ duration: 0.9 }} />
              <div className="space-y-7 relative">
                {STEPS.map((step, i) => {
                  const done = i <= current;
                  const active = i === current;
                  return (
                    <div key={step.id} className="flex items-start gap-4">
                      <div className="relative shrink-0">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center z-10 ${done ? "bg-primary text-white shadow-md" : "bg-background border-2 border-border"}`}>
                          {done ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-4 w-4 text-muted-foreground/50" />}
                        </div>
                        {active && order.status !== "delivered" && (
                          <motion.div className="absolute -top-7 -right-2 z-20 select-none">
                            <motion.span style={{ display: "inline-block" }} animate={{ x: [0, -4, 0, -4, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} className="text-2xl">🛵</motion.span>
                          </motion.div>
                        )}
                      </div>
                      <div className="pt-1">
                        <p className={`font-bold leading-tight ${active ? "text-primary text-base" : done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
                        {active && <p className="text-sm text-muted-foreground mt-0.5">{step.sub}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Driver info */}
          {order.driverName && current >= 1 && (
            <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-extrabold text-xl">
                {order.driverName.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">السائق المعين</p>
                <p className="font-bold text-base">{order.driverName}</p>
                {order.driverAvgRating != null && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(Number(order.driverAvgRating)) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
                    ))}
                    <span className="text-xs text-muted-foreground mr-1">({Number(order.driverAvgRating).toFixed(1)})</span>
                  </div>
                )}
              </div>
              <UserCircle className="h-6 w-6 text-muted-foreground/30" />
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setNoteOpen(true)} className="h-11 rounded-xl bg-muted text-sm font-bold flex items-center justify-center gap-2">
              <Pencil className="h-4 w-4" /> ملاحظة للسائق
            </button>
            <button onClick={() => setComplaintOpen(true)} className="h-11 rounded-xl bg-muted text-sm font-bold flex items-center justify-center gap-2 text-destructive">
              <MessageSquareWarning className="h-4 w-4" /> شكوى
            </button>
            {order.status === "delivered" && (
              <>
                <button onClick={downloadInvoice} className="h-11 rounded-xl bg-muted text-sm font-bold flex items-center justify-center gap-2">
                  <Download className="h-4 w-4" /> فاتورة PDF
                </button>
                {order.driverName && !thankSent && (
                  <button onClick={sendThanks} className="h-11 rounded-xl bg-primary/10 text-primary text-sm font-bold flex items-center justify-center gap-2">
                    ❤️ شكر السائق
                  </button>
                )}
              </>
            )}
          </div>

          {/* Rating */}
          <AnimatePresence>
            {order.status === "delivered" && !order.hasRating && !rated && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-card rounded-2xl border p-5 shadow-sm">
                <div className="text-center mb-4">
                  <p className="text-lg font-extrabold">كيف كانت تجربتك؟</p>
                  <p className="text-sm text-muted-foreground mt-0.5">قيّم السائق {order.driverName}</p>
                </div>
                <div className="flex justify-center gap-3 mb-4 cursor-pointer" dir="ltr">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`h-9 w-9 transition-all ${s <= (hovered || rating) ? "fill-yellow-400 text-yellow-400 scale-110" : "text-muted-foreground/25"}`}
                      onClick={() => setRating(s)} onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)} />
                  ))}
                </div>

                {/* Detailed ratings */}
                <div className="space-y-3 mb-4 bg-muted/30 rounded-xl p-3">
                  {[
                    { label: "السرعة", value: speedStars, setter: setSpeedStars },
                    { label: "الأمانة", value: honestyStars, setter: setHonestyStars },
                    { label: "حسن المعاملة", value: kindnessStars, setter: setKindnessStars },
                  ].map(d => (
                    <div key={d.label} className="flex items-center justify-between">
                      <span className="text-sm font-bold">{d.label}</span>
                      <div className="flex gap-1" dir="ltr">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`h-5 w-5 cursor-pointer ${s <= d.value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/25"}`}
                            onClick={() => d.setter(s)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Textarea placeholder="أضف تعليقاً (اختياري)..." className="mb-4 resize-none" rows={3}
                  value={comment} onChange={e => setComment(e.target.value)} />
                <Button className="w-full h-12 text-base font-bold" onClick={submitRating} disabled={ratingMutation.isPending}>
                  {ratingMutation.isPending ? "جاري الإرسال..." : "إرسال التقييم"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {order.status === "delivered" && (order.hasRating || rated) && (
            <div className="text-center py-6">
              <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-extrabold">تم التسليم بنجاح</p>
              <p className="text-sm text-muted-foreground mt-1">شكراً لاستخدامك يلا وصل</p>
              <Button variant="outline" className="mt-5" onClick={() => setLocation("/customer")}>طلب جديد</Button>
            </div>
          )}
        </div>
      )}

      {/* Note dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>ملاحظة للسائق</DialogTitle></DialogHeader>
          <Textarea placeholder="مثل: اترك الطلب عند البواب، شقة 5..." rows={4} value={noteText} onChange={e => setNoteText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>إلغاء</Button>
            <Button onClick={submitNote}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Address change */}
      <Dialog open={addrOpen} onOpenChange={setAddrOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تعديل عنوان التوصيل</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">يمكن التعديل قبل أن يستلم السائق الطلب فقط</p>
          <Input value={addrText} onChange={e => setAddrText(e.target.value)} placeholder="العنوان الجديد" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddrOpen(false)}>إلغاء</Button>
            <Button onClick={submitAddrChange}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complaint */}
      <Dialog open={complaintOpen} onOpenChange={setComplaintOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle><AlertCircle className="inline h-5 w-5 text-destructive ml-1" /> تقديم شكوى</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {COMPLAINT_REASONS.map(r => (
              <button key={r} onClick={() => setComplaintReason(r)} className={`w-full text-right p-3 rounded-lg border ${complaintReason === r ? "border-destructive bg-destructive/5" : "border-border"}`}>{r}</button>
            ))}
            {complaintReason === "آخر" && <Input placeholder="السبب..." value={complaintOther} onChange={e => setComplaintOther(e.target.value)} />}
            <Textarea placeholder="تفاصيل إضافية (اختياري)" value={complaintDesc} onChange={e => setComplaintDesc(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComplaintOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={submitComplaint} disabled={!complaintReason}>إرسال الشكوى</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CustomerLayout>
  );
}
