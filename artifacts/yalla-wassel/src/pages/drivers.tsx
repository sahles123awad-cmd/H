import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useListDrivers, useListZones, useRegister } from "@workspace/api-client-react";
import { getListDriversQueryKey } from "@workspace/api-client-react";
import { ManagerLayout } from "@/components/layout/manager-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus, Star, Package, MapPin, Phone, User, MoreVertical, Pause, Play, Target, MapPinned } from "lucide-react";
import { api } from "@/lib/api";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const addDriverSchema = z.object({
  fullName: z.string().min(2, "الاسم مطلوب"),
  phone: z.string().min(10, "رقم الهاتف غير صحيح"),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
  zoneId: z.coerce.number({ required_error: "المنطقة مطلوبة" }).min(1, "المنطقة مطلوبة"),
});

type AddDriverForm = z.infer<typeof addDriverSchema>;

const STATUS_LABELS: Record<string, string> = {
  available: "متاح", busy: "مشغول", off: "خارج الدوام", suspended: "موقوف",
};

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-700 border-green-200",
  busy: "bg-orange-100 text-orange-700 border-orange-200",
  off: "bg-gray-100 text-gray-500 border-gray-200",
  suspended: "bg-red-100 text-red-700 border-red-200",
};

export default function DriversPage() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const [goalOpen, setGoalOpen] = useState<any>(null);
  const [goalValue, setGoalValue] = useState(10);
  const [zonesOpen, setZonesOpen] = useState<any>(null);
  const [pickedZones, setPickedZones] = useState<number[]>([]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });

  const toggleSuspend = async (d: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (d.status === "suspended") { await api.reactivateDriver(d.id); toast.success("تم إعادة تفعيل السائق"); }
      else { await api.suspendDriver(d.id); toast.success("تم إيقاف السائق"); }
      refresh();
    } catch { toast.error("فشل"); }
  };

  const openGoal = (d: any, e: React.MouseEvent) => {
    e.stopPropagation(); setGoalValue(d.dailyGoal || 10); setGoalOpen(d);
  };
  const saveGoal = async () => {
    try { await api.setDailyGoal(goalOpen.id, goalValue); toast.success("تم حفظ الهدف"); setGoalOpen(null); refresh(); }
    catch { toast.error("فشل"); }
  };

  const openZones = async (d: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try { const z = await api.getDriverZones(d.id); setPickedZones(z?.map((x: any) => x.zoneId) || []); setZonesOpen(d); }
    catch { toast.error("فشل التحميل"); }
  };
  const saveZones = async () => {
    try { await api.setDriverZones(zonesOpen.id, pickedZones); toast.success("تم حفظ المناطق"); setZonesOpen(null); refresh(); }
    catch { toast.error("فشل"); }
  };

  const { data: drivers, isLoading } = useListDrivers();
  const { data: zones } = useListZones();
  const registerMutation = useRegister();

  const form = useForm<AddDriverForm>({
    resolver: zodResolver(addDriverSchema),
    defaultValues: { fullName: "", phone: "", password: "", zoneId: 0 },
  });

  const onSubmit = (data: AddDriverForm) => {
    registerMutation.mutate(
      { data: { ...data, role: "driver" } },
      {
        onSuccess: () => {
          toast.success("تم إضافة السائق بنجاح");
          queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
          form.reset();
          setOpen(false);
        },
        onError: (err: any) => {
          toast.error(err?.message || "فشل إضافة السائق");
        },
      }
    );
  };

  const filtered = (drivers ?? []).filter(
    (d) =>
      !search ||
      d.fullName.includes(search) ||
      d.phone.includes(search)
  );

  return (
    <ManagerLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">السائقون</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              إدارة سائقي التوصيل وحالاتهم
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 gap-2 font-bold">
                <UserPlus className="h-4 w-4" />
                إضافة سائق
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة سائق جديد</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الاسم الكامل</FormLabel>
                        <FormControl>
                          <Input placeholder="محمد أحمد" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>رقم الهاتف</FormLabel>
                        <FormControl>
                          <Input placeholder="07XXXXXXXX" dir="ltr" className="text-right" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>كلمة المرور</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••" dir="ltr" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zoneId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>منطقة العمل</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(Number(v))}
                          value={field.value ? String(field.value) : ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر المنطقة" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-60">
                            {zones?.map((z) => (
                              <SelectItem key={z.id} value={String(z.id)}>
                                {z.nameAr} — {z.governorate}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-3 justify-end pt-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      إلغاء
                    </Button>
                    <Button type="submit" disabled={registerMutation.isPending}>
                      {registerMutation.isPending ? "جاري الإضافة..." : "إضافة السائق"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث باسم السائق أو رقم هاتفه..."
            className="pr-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Drivers grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <User className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">
              {search ? "لا توجد نتائج مطابقة" : "لا يوجد سائقون بعد"}
            </p>
            {!search && (
              <p className="text-sm text-muted-foreground mt-1">
                أضف أول سائق بالضغط على زر &quot;إضافة سائق&quot;
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((driver) => (
              <Card
                key={driver.id}
                className="rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-primary/40"
                onClick={() => setLocation(`/manager/drivers/${driver.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-extrabold text-lg">
                        {driver.fullName.charAt(0)}
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold leading-tight">
                          {driver.fullName}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                          <Phone className="h-3 w-3" />
                          {driver.phone}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${STATUS_COLORS[driver.status ?? "off"]}`}>
                        {STATUS_LABELS[driver.status ?? "off"]}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e: any) => openGoal(driver, e)}>
                            <Target className="h-4 w-4 ml-2" /> هدف يومي
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e: any) => openZones(driver, e)}>
                            <MapPinned className="h-4 w-4 ml-2" /> مناطق ثابتة
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e: any) => toggleSuspend(driver, e)} className="text-destructive">
                            {(driver.status as string) === "suspended" ? <><Play className="h-4 w-4 ml-2" /> إعادة تفعيل</> : <><Pause className="h-4 w-4 ml-2" /> إيقاف مؤقت</>}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {driver.zoneName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary shrink-0" />
                      <span>{driver.zoneName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm pt-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold text-foreground">
                        {driver.avgRating != null
                          ? Number(driver.avgRating).toFixed(1)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Package className="h-4 w-4 text-blue-500" />
                      <span>
                        <span className="font-semibold text-foreground">{driver.totalOrders ?? 0}</span>
                        {" "}طلب
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      اليوم:{" "}
                      <span className="font-semibold text-foreground">{driver.deliveredToday ?? 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Daily goal */}
      <Dialog open={!!goalOpen} onOpenChange={(o) => !o && setGoalOpen(null)}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader><DialogTitle>الهدف اليومي للسائق</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">عدد الطلبات المستهدفة لـ {goalOpen?.fullName} يومياً</p>
          <Input type="number" min={0} value={goalValue} onChange={e => setGoalValue(Number(e.target.value))} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setGoalOpen(null)}>إلغاء</Button>
            <Button onClick={saveGoal}>حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Zones */}
      <Dialog open={!!zonesOpen} onOpenChange={(o) => !o && setZonesOpen(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader><DialogTitle>المناطق الثابتة لـ {zonesOpen?.fullName}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">السائق سيستلم طلبات هذه المناطق فقط</p>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {(zones || []).map((z: any) => (
              <label key={z.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                <input type="checkbox" checked={pickedZones.includes(z.id)}
                  onChange={(e) => setPickedZones(p => e.target.checked ? [...p, z.id] : p.filter(x => x !== z.id))} />
                <span className="text-sm">{z.nameAr} — {z.governorate}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setZonesOpen(null)}>إلغاء</Button>
            <Button onClick={saveZones}>حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </ManagerLayout>
  );
}
