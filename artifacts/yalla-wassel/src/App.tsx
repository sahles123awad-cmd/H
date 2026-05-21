import { useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ManagerDashboard from "@/pages/manager";
import DriverDashboard from "@/pages/driver";
import TrackOrder from "@/pages/track";
import DriversPage from "@/pages/drivers";
import DriverProfile from "@/pages/driver-profile";
import CustomerHome from "@/pages/customer-home";
import CustomerOrders from "@/pages/customer-orders";
import CustomerTrack from "@/pages/customer-track";
import ManagerAnalytics from "@/pages/manager-analytics";
import ManagerSchedule from "@/pages/manager-schedule";
import { useAuth } from "@/hooks/useAuth";
import { SplashScreen } from "@/components/splash-screen";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, role }: { component: any, role: string }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-primary">جاري التحميل...</div>;
  }
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  const roleRedirect = user?.role === 'manager' ? '/manager' : user?.role === 'customer' ? '/customer' : '/driver';
  if (user?.role !== role) {
    return <Redirect to={roleRedirect} />;
  }

  return <Component />;
}

function Router() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Switch>
      <Route path="/">
        {() => (
          isAuthenticated ? (
            <Redirect to={user?.role === 'manager' ? '/manager' : user?.role === 'customer' ? '/customer' : '/driver'} />
          ) : (
            <Redirect to="/login" />
          )
        )}
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/manager">
        {() => <ProtectedRoute component={ManagerDashboard} role="manager" />}
      </Route>
      <Route path="/driver">
        {() => <ProtectedRoute component={DriverDashboard} role="driver" />}
      </Route>
      <Route path="/manager/drivers">
        {() => <ProtectedRoute component={DriversPage} role="manager" />}
      </Route>
      <Route path="/manager/analytics">
        {() => <ProtectedRoute component={ManagerAnalytics} role="manager" />}
      </Route>
      <Route path="/manager/schedule">
        {() => <ProtectedRoute component={ManagerSchedule} role="manager" />}
      </Route>
      <Route path="/manager/drivers/:id">
        {() => <ProtectedRoute component={DriverProfile} role="manager" />}
      </Route>
      <Route path="/customer">
        {() => <ProtectedRoute component={CustomerHome} role="customer" />}
      </Route>
      <Route path="/customer/orders">
        {() => <ProtectedRoute component={CustomerOrders} role="customer" />}
      </Route>
      <Route path="/customer/track/:token">
        {() => <ProtectedRoute component={CustomerTrack} role="customer" />}
      </Route>
      <Route path="/track/:token" component={TrackOrder} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster position="top-center" richColors dir="rtl" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
