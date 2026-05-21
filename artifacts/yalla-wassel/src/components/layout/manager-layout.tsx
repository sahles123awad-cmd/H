import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Truck, Search, Bell, User, LogOut, FileText, Star, AlertCircle, BarChart3, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useListNotifications } from "@workspace/api-client-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getListNotificationsQueryKey } from "@workspace/api-client-react";

export function ManagerLayout({ children }: { children: React.ReactNode }) {
  const { user, setToken } = useAuth();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: notifications } = useListNotifications({ query: { refetchInterval: 30000 } as any });

  const handleLogout = () => {
    setToken(null);
    queryClient.clear();
    setLocation("/login");
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      toast.success("تم تحديد الكل كمقروء");
    } catch (err) {
      toast.error("حدث خطأ");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row rtl">
      {/* Sidebar for desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-l border-sidebar-border">
        <div className="h-20 flex items-center justify-center px-6 border-b border-sidebar-border">
          <img src="/logo-clean.png" alt="يلا وصل" className="h-14 w-auto" />
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-2">
          <Link href="/manager">
            <a className={`flex items-center px-4 py-3 rounded-xl font-medium transition-colors ${location === "/manager" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}>
              <FileText className="h-5 w-5 ml-3" />
              لوحة التحكم
            </a>
          </Link>
          <Link href="/manager/drivers">
            <a className={`flex items-center px-4 py-3 rounded-xl font-medium transition-colors ${location === "/manager/drivers" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}>
              <User className="h-5 w-5 ml-3" />
              السائقون
            </a>
          </Link>
          <Link href="/manager/schedule">
            <a className={`flex items-center px-4 py-3 rounded-xl font-medium transition-colors ${location === "/manager/schedule" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}>
              <Calendar className="h-5 w-5 ml-3" />
              جدول الدوام
            </a>
          </Link>
          <Link href="/manager/analytics">
            <a className={`flex items-center px-4 py-3 rounded-xl font-medium transition-colors ${location === "/manager/analytics" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}>
              <BarChart3 className="h-5 w-5 ml-3" />
              التحليلات
            </a>
          </Link>
        </div>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center px-4 py-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg">
              {user?.fullName?.charAt(0)}
            </div>
            <div className="mr-3 overflow-hidden">
              <p className="font-semibold truncate">{user?.fullName}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">مدير النظام</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 z-10 shadow-sm">
          <div className="flex items-center md:hidden">
            <img src="/logo-clean.png" alt="يلا وصل" className="h-9 w-auto" />
          </div>
          
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="بحث عن طلب، عميل، أو سائق..." 
                className="w-full pl-4 pr-10 bg-muted border-none h-10 rounded-full focus-visible:ring-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-card"></span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  الإشعارات
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-primary" onClick={markAllRead}>
                      تحديد الكل كمقروء
                    </Button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-80 overflow-y-auto">
                  {notifications?.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">لا توجد إشعارات</div>
                  ) : (
                    notifications?.slice(0, 10).map(n => (
                      <div key={n.id} className={`p-3 border-b border-border/50 text-sm ${n.isRead ? 'opacity-60' : 'bg-primary/5 font-medium'}`}>
                        <div className="flex items-start gap-2">
                          {n.type === 'order' ? <Truck className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /> : 
                           n.type === 'rating' ? <Star className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" /> : 
                           <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                          <p>{n.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 w-9 rounded-full bg-primary/10 text-primary p-0">
                  {user?.fullName?.charAt(0)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.fullName}</DropdownMenuLabel>
                <DropdownMenuItem className="text-muted-foreground">{user?.phone}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive font-medium cursor-pointer">
                  <LogOut className="h-4 w-4 ml-2" />
                  تسجيل خروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
