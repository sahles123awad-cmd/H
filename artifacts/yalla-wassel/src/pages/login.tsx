import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect } from "react";

const loginSchema = z.object({
  phone: z.string().min(1, "رقم الهاتف مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { setToken, isAuthenticated, user } = useAuth();
  
  useEffect(() => {
    if (isAuthenticated && user) {
      const dest = user.role === "manager" ? "/manager" : user.role === "customer" ? "/customer" : "/driver";
      setLocation(dest);
    }
  }, [isAuthenticated, user, setLocation]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: "",
      password: "",
    },
  });

  const loginMutation = useLogin();

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({ data }, {
      onSuccess: ({ token, user }) => {
        setToken(token);
        toast.success("تم تسجيل الدخول بنجاح");
        const dest = user.role === "manager" ? "/manager" : user.role === "customer" ? "/customer" : "/driver";
        setLocation(dest);
      },
      onError: () => {
        toast.error("فشل تسجيل الدخول. تأكد من رقم الهاتف وكلمة المرور.");
      }
    });
  };

  const fillDemo = (phone: string, password: string) => {
    form.setValue("phone", phone);
    form.setValue("password", password);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img src="/logo-clean.png" alt="يلا وصل" className="h-28 w-auto" />
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-border">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

              <Button
                type="submit"
                className="w-full h-12 text-lg font-bold"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "جاري الدخول..." : "تسجيل الدخول"}
              </Button>
            </form>
          </Form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">أو</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link href="/register" className="font-medium text-primary hover:text-primary/80">
                تسجيل حساب جديد
              </Link>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-muted rounded-xl text-sm border border-border">
            <p className="font-bold mb-3 text-foreground">حسابات تجريبية:</p>
            <div className="space-y-2">
              {[
                { role: "مدير",  phone: "0791234567",  password: "Manager123!", color: "bg-primary/10 text-primary border-primary/20" },
                { role: "سائق",  phone: "07766772752", password: "Driver123!",  color: "bg-secondary/10 text-secondary border-secondary/20" },
                { role: "زبون",  phone: "0799999999",  password: "Customer123!", color: "bg-green-50 text-green-700 border-green-200" },
              ].map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => fillDemo(acc.phone, acc.password)}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 border text-right transition-all hover:opacity-80 active:scale-[0.98] ${acc.color}`}
                >
                  <span className="font-bold text-xs">{acc.role}</span>
                  <span className="font-mono text-xs opacity-80" dir="ltr">{acc.phone} / {acc.password}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 text-center">اضغط على الحساب لملء البيانات تلقائياً</p>
          </div>
        </div>
      </div>
    </div>
  );
}
