import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useListZones, useCreateCustomerOrder } from "@workspace/api-client-react";
import { CustomerLayout } from "@/components/layout/customer-layout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Copy, ArrowRight, MapPin, ChevronLeft } from "lucide-react";

/* ── Categories ─────────────────────────────────────────── */
const CATEGORIES = [
  {
    id: "food",
    label: "مطاعم",
    img: "/categories/food.jpg",
    gradient: "from-orange-50 to-orange-100",
    border: "border-orange-200",
  },
  {
    id: "grocery",
    label: "بقالة",
    img: "/categories/grocery.jpg",
    gradient: "from-green-50 to-green-100",
    border: "border-green-200",
  },
  {
    id: "pharmacy",
    label: "صيدلية",
    img: "/categories/pharmacy.png",
    gradient: "from-teal-50 to-teal-100",
    border: "border-teal-200",
  },
  {
    id: "flowers",
    label: "ورد",
    img: "/categories/flowers.webp",
    gradient: "from-pink-50 to-pink-100",
    border: "border-pink-200",
  },
  {
    id: "electronics",
    label: "إلكترونيات",
    img: "/categories/electronics.jpg",
    gradient: "from-blue-50 to-blue-100",
    border: "border-blue-200",
  },
  {
    id: "clothing",
    label: "ملابس",
    img: "/categories/clothing.jpg",
    gradient: "from-slate-50 to-slate-100",
    border: "border-slate-200",
  },
  {
    id: "other",
    label: "أخرى",
    img: null,
    emoji: "📦",
    gradient: "from-amber-50 to-amber-100",
    border: "border-amber-200",
  },
];

/* ── Schemas & types ────────────────────────────────────── */
const orderSchema = z.object({
  category: z.string().min(1, "اختر الفئة"),
  fromBusiness: z.string().min(2, "اسم المحل مطلوب"),
  fromAddress: z.string().min(3, "عنوان المحل مطلوب"),
  fromZoneId: z.coerce.number().int().positive("اختر منطقة المحل"),
  toAddress: z.string().min(3, "عنوانك مطلوب"),
  toZoneId: z.coerce.number().int().positive("اختر منطقتك"),
  notes: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderSchema>;
type Zone = { id: number; nameAr: string; governorate?: string | null };

function groupByGovernorate(zones: Zone[]) {
  const map = new Map<string, Zone[]>();
  for (const z of zones) {
    const gov = z.governorate ?? "أخرى";
    if (!map.has(gov)) map.set(gov, []);
    map.get(gov)!.push(z);
  }
  return map;
}

function ZoneSelectContent({ zones }: { zones: Zone[] | undefined }) {
  if (!zones?.length) return null;
  const grouped = groupByGovernorate(zones);
  return (
    <SelectContent className="max-h-64 overflow-y-auto">
      {Array.from(grouped.entries()).map(([gov, items]) => (
        <SelectGroup key={gov}>
          <SelectLabel className="text-xs font-bold text-primary px-2 py-1">{gov}</SelectLabel>
          {items.map((z) => (
            <SelectItem key={z.id} value={z.id.toString()}>{z.nameAr}</SelectItem>
          ))}
        </SelectGroup>
      ))}
    </SelectContent>
  );
}

/* ── Main component ─────────────────────────────────────── */
export default function CustomerHome() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: zones } = useListZones();
  const createOrder = useCreateCustomerOrder();
  const [success, setSuccess] = useState<{ trackingToken: string; orderId: string } | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: { category: "", fromBusiness: "", fromAddress: "", fromZoneId: 0, toAddress: "", toZoneId: 0, notes: "" },
  });

  const onSubmit = (data: OrderFormValues) => {
    createOrder.mutate(
      { data: { ...data, fromZoneId: Number(data.fromZoneId), toZoneId: Number(data.toZoneId) } as any },
      {
        onSuccess: (res: any) => {
          setSuccess({ trackingToken: res.trackingToken, orderId: res.orderId });
          form.reset();
          setSelectedCat(null);
        },
        onError: () => toast.error("فشل إرسال الطلب. حاول مرة أخرى."),
      }
    );
  };

  const activeCat = CATEGORIES.find((c) => c.id === selectedCat);

  /* ── Success screen ───────────────────────────────────── */
  if (success) {
    return (
      <CustomerLayout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center py-10 gap-6"
        >
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="h-14 w-14 text-green-500" />
            </div>
            <motion.span
              className="absolute -top-1 -right-1 text-2xl"
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: 2, duration: 0.4 }}
              style={{ fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" }}
            >🎉</motion.span>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-foreground">تم إرسال طلبك!</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              رقم الطلب:{" "}
              <span className="font-mono font-bold text-foreground">{success.orderId}</span>
            </p>
            <p className="text-muted-foreground text-sm mt-1">سيقوم المدير بتعيين سائق لتوصيلك قريباً</p>
          </div>

          <div className="w-full space-y-3">
            <Button
              className="w-full h-12 text-base font-bold gap-2"
              onClick={() => setLocation(`/customer/track/${success.trackingToken}`)}
            >
              تتبع طلبك الآن
            </Button>
            <Button variant="outline" className="w-full h-12 text-base" onClick={() => setSuccess(null)}>
              طلب جديد
            </Button>
          </div>
        </motion.div>
      </CustomerLayout>
    );
  }

  /* ── Order form (after category selected) ─────────────── */
  if (selectedCat && activeCat) {
    return (
      <CustomerLayout>
        <motion.div
          key="form"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Back + category header */}
          <div className="flex items-center gap-3 mb-5">
            <button
              type="button"
              onClick={() => { setSelectedCat(null); form.setValue("category", ""); }}
              className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors shrink-0"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
            <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${activeCat.gradient} flex items-center justify-center`}>
              <span className="text-lg" style={{ fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" }}>
                {activeCat.emoji}
              </span>
            </div>
            <div>
              <p className="font-extrabold text-base text-foreground leading-tight">{activeCat.label}</p>
              <p className="text-xs text-muted-foreground">أدخل تفاصيل طلبك</p>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* From */}
              <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <p className="font-bold text-sm text-foreground">الاستلام من</p>
                </div>
                <FormField control={form.control} name="fromBusiness" render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم المحل / المطعم</FormLabel>
                    <FormControl><Input placeholder="مثال: مطعم الزيتونة" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fromAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel>عنوان المحل</FormLabel>
                    <FormControl><Input placeholder="مثال: شارع الرينبو، عمان" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fromZoneId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>منطقة المحل</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString() || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="اختر المنطقة" /></SelectTrigger></FormControl>
                      <ZoneSelectContent zones={zones} />
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* To */}
              <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="font-bold text-sm text-foreground">التوصيل إلى</p>
                </div>
                <FormField control={form.control} name="toAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel>عنوانك التفصيلي</FormLabel>
                    <FormControl><Input placeholder="مثال: خلف البنك العربي، الطابق 2" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="toZoneId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>منطقتك</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString() || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="اختر المنطقة" /></SelectTrigger></FormControl>
                      <ZoneSelectContent zones={zones} />
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Notes */}
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>ملاحظات (اختياري)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="أي تعليمات للسائق أو المحل..." className="resize-none" rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )} />

              <Button type="submit" className="w-full h-12 text-base font-bold" disabled={createOrder.isPending}>
                {createOrder.isPending ? "جاري إرسال الطلب..." : "أرسل الطلب 🚀"}
              </Button>
            </form>
          </Form>
        </motion.div>
      </CustomerLayout>
    );
  }

  /* ── Home / category picker ───────────────────────────── */
  const firstName = user?.fullName?.split(" ")[0] ?? "عزيزي";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "صباح الخير" : hour < 18 ? "مساء الخير" : "مساء النور";

  return (
    <CustomerLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

        {/* Category title */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-extrabold text-foreground">اختر الفئة</h2>
        </div>

        {/* Category grid — Talabat-style */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {CATEGORIES.map((cat, i) => (
            <motion.button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCat(cat.id);
                form.setValue("category", cat.id);
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 20 }}
              whileTap={{ scale: 0.92 }}
              className="flex flex-col items-center gap-2 group"
            >
              {/* Icon card */}
              <div
                className={`w-full aspect-square rounded-2xl bg-gradient-to-br ${cat.gradient} border ${(cat as any).border} flex items-center justify-center overflow-hidden relative shadow-sm transition-all group-active:shadow-none`}
              >
                <div className="absolute inset-0 bg-white/30 opacity-0 group-active:opacity-100 transition-opacity" />
                {(cat as any).img ? (
                  <img
                    src={(cat as any).img}
                    alt={cat.label}
                    className="w-[78%] h-[78%] object-contain drop-shadow-sm"
                  />
                ) : (
                  <span
                    className="text-3xl drop-shadow-sm"
                    style={{ fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" }}
                  >
                    {(cat as any).emoji}
                  </span>
                )}
              </div>
              {/* Label */}
              <span className="text-[11px] font-bold text-foreground leading-tight text-center">{cat.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Quick tip banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-primary/5 border border-primary/15 rounded-2xl p-4 flex items-center gap-3"
        >
          <span
            className="text-3xl shrink-0"
            style={{ fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" }}
          >⚡</span>
          <div>
            <p className="text-sm font-bold text-foreground">توصيل سريع في عمّان</p>
            <p className="text-xs text-muted-foreground mt-0.5">اختر الفئة لبدء طلبك والسائق سيصلك في أقرب وقت</p>
          </div>
          <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0" />
        </motion.div>

      </motion.div>
    </CustomerLayout>
  );
}
