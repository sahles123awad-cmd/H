import { useRoute, useLocation } from "wouter";
import { useGetUser, useListRatings, useListOrders } from "@workspace/api-client-react";
import { ManagerLayout } from "@/components/layout/manager-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Star, Package, MapPin, Phone, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

const STATUS_LABELS: Record<string, string> = {
  available: "متاح",
  busy: "مشغول",
  off: "خارج الدوام",
};
const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-700 border-green-200",
  busy: "bg-orange-100 text-orange-700 border-orange-200",
  off: "bg-gray-100 text-gray-500 border-gray-200",
};
const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: "قيد الانتظار", color: "bg-muted text-muted-foreground" },
  assigned:  { label: "تم التعيين",   color: "bg-blue-100 text-blue-700" },
  picked:    { label: "تم الاستلام",  color: "bg-yellow-100 text-yellow-700" },
  delivered: { label: "تم التوصيل",  color: "bg-green-100 text-green-700" },
  cancelled: { label: "ملغي",        color: "bg-red-100 text-red-700" },
};

export default function DriverProfile() {
  const [, params] = useRoute("/manager/drivers/:id");
  const [, setLocation] = useLocation();
  const driverId = Number(params?.id);

  const { data: driver, isLoading: driverLoading } = useGetUser(driverId, {
    query: { enabled: !!driverId } as any,
  });

  const { data: ratings, isLoading: ratingsLoading } = useListRatings(
    { driverId },
    { query: { enabled: !!driverId } as any }
  );

  const { data: orders, isLoading: ordersLoading } = useListOrders(
    undefined,
    { query: { enabled: !!driverId } as any }
  );

  const driverOrders = orders?.filter((o) => o.driverId === driverId) ?? [];
  const delivered = driverOrders.filter((o) => o.status === "delivered").length;
  const active = driverOrders.filter((o) => ["assigned", "picked"].includes(o.status)).length;
  const avgRating =
    ratings && ratings.length > 0
      ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1)
      : null;

  if (driverLoading) {
    return (
      <ManagerLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </ManagerLayout>
    );
  }

  if (!driver) {
    return (
      <ManagerLayout>
        <div className="text-center py-20 text-muted-foreground">السائق غير موجود</div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Back */}
        <Button
          variant="ghost"
          className="gap-2 -mr-2 text-muted-foreground hover:text-foreground"
          onClick={() => setLocation("/manager/drivers")}
        >
          <ArrowRight className="h-4 w-4" />
          العودة للسائقين
        </Button>

        {/* Header card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="h-2 bg-primary" />
            <CardContent className="pt-6 pb-5">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-extrabold text-2xl shadow-inner">
                    {driver.fullName.charAt(0)}
                  </div>
                  <div>
                    <h1 className="text-2xl font-extrabold text-foreground">{driver.fullName}</h1>
                    <p className="text-muted-foreground flex items-center gap-1.5 mt-0.5" dir="ltr">
                      <Phone className="h-4 w-4" />
                      {driver.phone}
                    </p>
                    {driver.zoneName && (
                      <p className="text-muted-foreground flex items-center gap-1.5 mt-0.5 text-sm">
                        <MapPin className="h-4 w-4 text-primary" />
                        {driver.zoneName}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`text-sm px-3 py-1.5 rounded-full border font-semibold ${STATUS_COLORS[driver.status ?? "off"]}`}>
                  {STATUS_LABELS[driver.status ?? "off"]}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {[
            { icon: <Package className="h-5 w-5 text-primary" />, label: "إجمالي الطلبات", value: driverOrders.length },
            { icon: <CheckCircle className="h-5 w-5 text-green-600" />, label: "مُوصَّلة", value: delivered },
            { icon: <Clock className="h-5 w-5 text-blue-500" />, label: "نشطة الآن", value: active },
            {
              icon: <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />,
              label: "متوسط التقييم",
              value: avgRating ?? "—",
            },
          ].map((s, i) => (
            <Card key={i} className="rounded-xl border-border shadow-sm">
              <CardContent className="p-4 text-center space-y-1">
                <div className="flex justify-center">{s.icon}</div>
                <div className="text-2xl font-extrabold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Ratings */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.14 }}>
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                تقييمات الزبائن
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ratingsLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
              ) : !ratings || ratings.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  لا توجد تقييمات بعد
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {ratings.map((r) => (
                    <div key={r.id} className="p-4 flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-sm shrink-0">
                        {r.customerName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{r.customerName}</span>
                          <div className="flex items-center gap-0.5" dir="ltr">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${i < r.stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                              />
                            ))}
                          </div>
                        </div>
                        {r.comment && (
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">{r.comment}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Orders history */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" />
                سجل الطلبات
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ordersLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
                </div>
              ) : driverOrders.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  لا توجد طلبات مسندة لهذا السائق بعد
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {driverOrders.slice(0, 20).map((o) => (
                    <div key={o.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{o.orderId}</p>
                        <p className="font-medium text-sm">{o.fromBusiness} ← {o.toCustomerName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" /> {o.toZoneName}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-xs ${ORDER_STATUS[o.status]?.color ?? ""}`}
                      >
                        {ORDER_STATUS[o.status]?.label ?? o.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </ManagerLayout>
  );
}
