import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useRegister, useListZones } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const registerSchema = z.object({
  fullName: z.string().min(2, "الاسم مطلوب"),
  phone: z.string().min(10, "رقم الهاتف يجب ان يكون صحيحا"),
  password: z.string().min(6, "كلمة المرور 6 احرف على الاقل"),
  role: z.enum(["manager", "driver", "customer"]),
  zoneId: z.coerce.number().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { setToken } = useAuth();
  const { data: zones } = useListZones();
  
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      password: "",
      role: "customer" as const,
    },
  });

  const role = form.watch("role");
  const registerMutation = useRegister();

  const onSubmit = (data: RegisterFormValues) => {
    if (data.role === "driver" && !data.zoneId) {
      form.setError("zoneId", { message: "المنطقة مطلوبة للسائق" });
      return;
    }
    
    registerMutation.mutate({ data }, {
      onSuccess: ({ token, user }) => {
        setToken(token);
        toast.success("تم التسجيل بنجاح");
        setLocation(user.role === "manager" ? "/manager" : user.role === "customer" ? "/customer" : "/driver");
      },
      onError: () => {
        toast.error("فشل التسجيل. يرجى المحاولة مرة اخرى.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img src="/logo-clean.png" alt="يلا وصل" className="h-24 w-auto" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          حساب جديد
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-border">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                      <Input placeholder="079..." dir="ltr" className="text-right" {...field} />
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
                      <Input type="password" dir="ltr" className="text-right" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع الحساب</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر نوع الحساب" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="customer">زبون (طلب توصيل)</SelectItem>
                        <SelectItem value="driver">سائق</SelectItem>
                        <SelectItem value="manager">مدير</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {role === "driver" && (
                <FormField
                  control={form.control}
                  name="zoneId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>منطقة العمل</FormLabel>
                      <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString() || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر المنطقة" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {zones?.map(zone => (
                            <SelectItem key={zone.id} value={zone.id.toString()}>
                              {zone.nameAr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Button
                type="submit"
                className="w-full h-12 text-lg font-bold mt-4"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "جاري التسجيل..." : "تسجيل"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <span className="text-muted-foreground text-sm ml-2">لديك حساب بالفعل؟</span>
            <Link href="/login" className="font-medium text-primary hover:text-primary/80 text-sm">
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
