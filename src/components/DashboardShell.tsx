import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { isProPlan, PLANS } from "@/convex/plans";
import { Crown, LogOut, UtensilsCrossed } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

export function DashboardShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const sub = useQuery(api.billing.getMySubscription);
  const pro = isProPlan(sub?.plan);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 px-4 pt-4">
        <div className="clay-card clay-ring mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-3 shadow-[0_10px_30px_rgba(96,110,140,0.15)]">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="clay-teal clay-sm flex size-9 items-center justify-center rounded-2xl">
              <UtensilsCrossed className="size-4 text-white" />
            </div>
            <span className="font-bold text-clay-deep">
              Menu<span className="text-primary">Maker</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Badge
              className={
                pro
                  ? "clay-teal rounded-full border-0 px-3 py-1 font-bold text-white"
                  : "clay-in rounded-full border-0 bg-muted px-3 py-1 font-bold text-muted-foreground"
              }
            >
              {pro ? (
                <>
                  <Crown className="mr-1 size-3.5" /> Plan Pro
                </>
              ) : (
                <>Plan {PLANS.FREE.label}</>
              )}
            </Badge>
            {!pro && (
              <Button asChild size="sm" className="clay-btn clay-teal hidden rounded-2xl font-bold text-white sm:inline-flex">
                <Link to="/subscription">
                  <Crown className="size-4" /> Passer Pro
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              title="Se déconnecter"
              className="rounded-2xl"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[Baloo_2] text-3xl font-extrabold">{title}</h1>
            {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
            {user?.email && (
              <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
