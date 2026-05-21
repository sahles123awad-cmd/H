import { useLocation } from "wouter";
import { useGetMyOrders } from "@workspace/api-client-react";
import { CustomerLayout } from "@/components/layout/customer-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Package, Clock, CheckCircle2, Truck, MapPin, ExternalLink } from "lucide-react";

const STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "قيد الانتظار",  color: "bg-muted text-muted-foreground",          icon: <Clock className="h-4 w-4" /> },
  assigned:  { label: "تم تعيين سائق", color: "bg-blue-100 text-blue-700",               icon: <Truck className="h-4 w-4" /> },
  picked:    { label: "في الطريق",     color: "bg-amber-100 text-amber-700",              icon: <Truck className="h-4 w-4" /> },
  delivered: { label: "تم التسليم",    color: "bg-green-100 text-green-700",              icon: <CheckCircle2 className="h-4 w-4" /> },
  cancelled: { label: "ملغي",          color: "bg-red-100 text-red-600",                  icon: <Package className="h-4 w-4" /> },
};

export default function CustomerOrders() {
  const [, setLocation] = useLocation();
  const { data: orders, isLoading } = useGetMyOrders({
    query: { refetchInterval: 15000 } as any,
  });

  return (
    <CustomerLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">طلباتي</h1>
          <p className="text-muted-foreground text-sm mt-0.5">كل طلباتك في مكان واحد</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">لا توجد طلبات بعد</p>
              <p className="text-muted-foreground text-sm mt-1">اضغط على "طلب جديد" لتقديم أول طلب</p>
            </div>
            <Button onClick={() => setLocation("/customer")}>
              اطلب الآن
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order, i) => {
              const s = STATUS[order.status] ?? STATUS.pending;
              const isActive = ["pending", "assigned", "picked"].includes(order.status);

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`bg-card rounded-2xl border p-4 space-y-3 ${isActive ? "border-primary/30 shadow-sm" : "border-border"}`}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{order.orderId}</p>
                      <p className="font-bold text-base mt-0.5">{order.fromBusiness}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full ${s.color}`}>
                      {s.icon}
                      {s.label}
                    </span>
                  </div>

                  {/* Address row */}
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                    <span>{order.toAddress}</span>
                  </div>

                  {/* ETA + driver */}
                  {isActive && (
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      {(order as any).estimatedMinutes != null ? (
                        <span className="flex items-center gap-1.5 text-sm font-bold text-primary">
                          <Clock className="h-4 w-4" />
                          {(order as any).estimatedMinutes} دقيقة متوقعة
                        </span>
                      ) : <span />}
                      {order.driverName && (
                        <span className="text-sm text-muted-foreground">
                          السائق: <span className="font-bold text-foreground">{order.driverName}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Track button */}
                  <Button
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => setLocation(`/customer/track/${order.trackingToken}`)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {isActive ? "تتبع طلبك الآن" : "عرض التفاصيل"}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
