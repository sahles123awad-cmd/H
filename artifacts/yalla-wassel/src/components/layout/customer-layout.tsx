import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, ShoppingBag, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { user, setToken } = useAuth();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    setToken(null);
    queryClient.clear();
    setLocation("/login");
  };

  const navItems = [
    { href: "/customer", label: "طلب جديد", icon: ShoppingBag },
    { href: "/customer/orders", label: "طلباتي", icon: ClipboardList },
  ];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col rtl pb-16">
      {/* Top header */}
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 sticky top-0 z-20 shadow-sm">
        <img src="/logo-clean.png" alt="يلا وصل" className="h-9 w-auto" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 w-9 rounded-full bg-primary/10 text-primary font-bold p-0 text-base">
              {user?.fullName?.charAt(0)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-bold">{user?.fullName}</DropdownMenuLabel>
            <DropdownMenuItem className="text-muted-foreground text-sm">{user?.phone}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive font-medium cursor-pointer">
              <LogOut className="h-4 w-4 ml-2" />
              تسجيل خروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Page content */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-5">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around z-20">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <Link key={href} href={href} className={`flex flex-col items-center justify-center gap-1 w-24 h-full transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className={`h-6 w-6 ${active ? "stroke-[2.5]" : ""}`} />
              <span className="text-[11px] font-bold">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
