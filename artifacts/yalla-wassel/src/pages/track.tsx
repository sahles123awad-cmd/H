import { useRoute } from "wouter";
import { useTrackOrder, useCreateRating } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Package, MapPin, CheckCircle2, Clock, UserCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { EtaCountdown } from "@/components/eta-countdown";

const STEPS = [
  { id: "pending",   label: "تم استلام الطلب",     sub: "الطلب وصلنا وجاري التجهيز" },
  { id: "assigned",  label: "تم تعيين السائق",      sub: "السائق في طريقه لاستلام الطلب" },
  { id: "picked",    label: "السائق استلم الطلب",   sub: "الطلب في الطريق إليك" },
  { id: "delivered", label: "تم التسليم",           sub: "وصل الطلب بنجاح" },
];

const stepIndex = (status: string) => STEPS.findIndex((s) => s.id === status);

export default function TrackOrder() {
  const [, params] = useRoute("/track/:token");
  const token = params?.token ?? "";
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [rated, setRated] = useState(false);

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

  const submitRating = () => {
    ratingMutation.mutate(
      {
        data: {
          orderId: 0,
          driverId: 0,
          customerName: order?.toCustomerName ?? "زبون",
          stars: rating,
          comment,
        },
      },
      {
        onSuccess: () => {
          toast.success("شكراً لتقييمك! رأيك يهمنا.");
          setRated(true);
          refetch();
        },
        onError: () => {
          toast.success("شكراً لتقييمك!");
          setRated(true);
        },
      }
    );
  };

  /* ── States ─────────────────────────────────────────── */
  if (!token) {
    return (
      <Page>
        <EmptyState icon={<Package className="h-12 w-12" />} title="رابط التتبع غير صحيح" />
      </Page>
    );
  }

  if (isLoading) {
    return (
      <Page>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </Page>
    );
  }

  if (!order) {
    return (
      <Page>
        <EmptyState
          icon={<Package className="h-12 w-12" />}
          title="الطلب غير موجود"
          sub="تأكد من صحة رابط التتبع."
        />
      </Page>
    );
  }

  if (order.status === "cancelled") {
    return (
      <Page>
        <EmptyState
          icon={<Package className="h-12 w-12 text-destructive" />}
          title="تم إلغاء الطلب"
          sub="عذراً، تم إلغاء هذا الطلب."
          danger
        />
      </Page>
    );
  }

  const current = stepIndex(order.status);

  return (
    <Page>
      {/* Order ID banner */}
      <div className="text-center pt-6 pb-4 px-4">
        <p className="text-xs text-white/60 uppercase tracking-widest mb-1">تتبع طلبك</p>
        <p className="text-white font-mono text-lg font-bold">{order.orderId}</p>
      </div>

      {/* White card body */}
      <div className="flex-1 bg-background rounded-t-3xl px-4 pt-6 pb-10 space-y-5 overflow-y-auto">

        {/* ETA countdown for customer */}
        {order.eta && (order.status as string) !== "delivered" && (order.status as string) !== "cancelled" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <EtaCountdown eta={order.eta} delivered={(order.status as string) === "delivered"} />
          </motion.div>
        )}

        {/* From → To */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">من</p>
              <p className="font-bold">{order.fromBusiness}</p>
            </div>
          </div>
          <div className="border-r-2 border-dashed border-border h-4 mr-4" />
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
              <MapPin className="h-4 w-4 text-secondary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إلى</p>
              <p className="font-bold">{order.toCustomerName}</p>
              {order.toAddress && (
                <p className="text-sm text-muted-foreground mt-0.5">{order.toAddress}</p>
              )}
              {order.toZoneName && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />{order.toZoneName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Progress steps */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="relative">
            {/* track line */}
            <div className="absolute top-5 bottom-5 right-[18px] w-0.5 bg-border" />
            <motion.div
              className="absolute top-5 right-[18px] w-0.5 bg-primary origin-top"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: current >= 0 ? current / (STEPS.length - 1) : 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
            <div className="space-y-7 relative">
              {STEPS.map((step, i) => {
                const done = i <= current;
                const active = i === current;
                return (
                  <div key={step.id} className="flex items-start gap-4">
                    {/* Circle icon — bike rider sits here when active */}
                    <div className="relative shrink-0">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center z-10 transition-all duration-500 ${
                          done
                            ? "bg-primary text-white shadow-md shadow-primary/30"
                            : "bg-background border-2 border-border"
                        }`}
                      >
                        {done ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-4 w-4 text-muted-foreground/50" />}
                      </div>

                      {/* 🛵 Delivery bike — floats above the active step circle */}
                      {active && order.status !== "delivered" && (
                        <motion.div
                          layoutId="delivery-bike"
                          className="absolute -top-7 -right-2 z-20 select-none pointer-events-none"
                          initial={false}
                          transition={{ type: "spring", stiffness: 260, damping: 22 }}
                        >
                          <motion.span
                            style={{ display: "inline-block", fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" }}
                            animate={{ x: [0, -4, 0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                            className="text-2xl"
                          >
                            🛵
                          </motion.span>
                        </motion.div>
                      )}
                    </div>

                    <div className="pt-1">
                      <p className={`font-bold leading-tight ${active ? "text-primary text-base" : done ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                      {active && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-sm text-muted-foreground mt-0.5"
                        >
                          {step.sub}
                        </motion.p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Driver info (when assigned or later) */}
        {order.driverName && current >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-border p-4 shadow-sm flex items-center gap-4"
          >
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-extrabold text-xl">
              {order.driverName.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">السائق المعين</p>
              <p className="font-bold text-base">{order.driverName}</p>
              {order.driverAvgRating != null && (
                <div className="flex items-center gap-1 mt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${
                        i < Math.round(Number(order.driverAvgRating))
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/20"
                      }`}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground mr-1">
                    ({Number(order.driverAvgRating).toFixed(1)})
                  </span>
                </div>
              )}
            </div>
            <UserCircle className="h-6 w-6 text-muted-foreground/30" />
          </motion.div>
        )}

        {/* Rating form */}
        <AnimatePresence>
          {order.status === "delivered" && !order.hasRating && !rated && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-card rounded-2xl border border-border p-5 shadow-sm"
            >
              <div className="text-center mb-4">
                <p className="text-lg font-extrabold">كيف كانت تجربتك؟</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  قيّم السائق {order.driverName}
                </p>
              </div>

              <div className="flex justify-center gap-3 mb-4 cursor-pointer" dir="ltr">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-10 w-10 transition-all ${
                      s <= (hovered || rating)
                        ? "fill-yellow-400 text-yellow-400 scale-110"
                        : "text-muted-foreground/25"
                    }`}
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHovered(s)}
                    onMouseLeave={() => setHovered(0)}
                  />
                ))}
              </div>

              <Textarea
                placeholder="أضف تعليقاً (اختياري)..."
                className="mb-4 resize-none bg-background"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />

              <Button
                className="w-full h-12 text-base font-bold"
                onClick={submitRating}
                disabled={ratingMutation.isPending}
              >
                {ratingMutation.isPending ? "جاري الإرسال..." : "إرسال التقييم"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delivered + rated */}
        {order.status === "delivered" && (order.hasRating || rated) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-6"
          >
            <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-extrabold text-foreground">تم التسليم بنجاح</p>
            <p className="text-sm text-muted-foreground mt-1">شكراً لاستخدامك يلا وصل</p>
          </motion.div>
        )}
      </div>
    </Page>
  );
}

/* ── Layout helpers ─────────────────────────────────────── */
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-primary flex flex-col rtl">
      {/* Logo bar */}
      <div className="flex items-center justify-center gap-2 px-4 pt-5 pb-2">
        <img src="/logo-clean.png" alt="يلا وصل" className="h-14 w-auto drop-shadow-md" />
      </div>
      {children}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  sub,
  danger,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex-1 bg-background rounded-t-3xl flex flex-col items-center justify-center p-8 text-center">
      <div className={`mb-4 ${danger ? "text-destructive" : "text-muted-foreground/30"}`}>{icon}</div>
      <p className={`text-xl font-bold mb-1 ${danger ? "text-destructive" : "text-foreground"}`}>{title}</p>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}
