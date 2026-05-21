import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Truck, Home, User, LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user, setToken } = useAuth();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    setToken(null);
    queryClient.clear();
    setLocation("/login");
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col rtl pb-16 md:pb-0">
      {/* Mobile Topbar */}
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center">
          <img src="/logo-clean.png" alt="يلا وصل" className="h-9 w-auto" />
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
            <Bell className="h-5 w-5 text-muted-foreground" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 rounded-full bg-primary/10 text-primary p-0">
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

      {/* Main content */}
      <main className="flex-1 flex flex-col w-full max-w-md mx-auto relative">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 z-20 md:hidden pb-safe">
        <Link href="/driver">
          <a className={`flex flex-col items-center justify-center w-16 h-full space-y-1 ${location === '/driver' ? 'text-primary' : 'text-muted-foreground'}`}>
            <Home className="h-6 w-6" />
            <span className="text-[10px] font-bold">الرئيسية</span>
          </a>
        </Link>
        <button className="flex flex-col items-center justify-center w-16 h-full space-y-1 text-muted-foreground opacity-50 cursor-not-allowed">
          <Truck className="h-6 w-6" />
          <span className="text-[10px] font-bold">طلباتي</span>
        </button>
        <button className="flex flex-col items-center justify-center w-16 h-full space-y-1 text-muted-foreground opacity-50 cursor-not-allowed">
          <User className="h-6 w-6" />
          <span className="text-[10px] font-bold">حسابي</span>
        </button>
      </div>
    </div>
  );
}
