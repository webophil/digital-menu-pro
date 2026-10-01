import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { isProSubscription } from "@/convex/plans";
import {
  BookOpen,
  Crown,
  LogOut,
  Palette,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { BrandLogo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

/** Lien de navigation du header, surligné sur la page courante. */
function NavLinkButton({
  to,
  icon,
  label,
  disabled = false,
  alwaysLabel = false,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  alwaysLabel?: boolean;
}) {
  const { pathname } = useLocation();
  const active = !disabled && pathname === to;

  if (disabled) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        title="Bientôt disponible"
        className="clay-sm rounded-2xl border-0 bg-card font-bold text-muted-foreground"
      >
        {icon}
        <span className={alwaysLabel ? "" : "hidden sm:inline"}>{label}</span>
      </Button>
    );
  }

  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className={cn(
        "rounded-2xl border-0 font-bold",
        active
          ? "clay-btn clay-teal text-white"
          : "clay-sm bg-card",
      )}
    >
      <Link to={to} title={label}>
        {icon}
        <span className={alwaysLabel ? "" : "hidden sm:inline"}>{label}</span>
      </Link>
    </Button>
  );
}

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
  const role = useQuery(api.admin.myRole);
  const pro = isProSubscription(sub);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 px-4 pt-4">
        <div className="clay-card clay-ring mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-3 shadow-[0_10px_30px_rgba(96,110,140,0.15)]">
          <Link to="/dashboard" className="flex items-center gap-2">
            <BrandLogo className="h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <NavLinkButton
              to="/mes-infos"
              icon={<UserRound className="size-4" />}
              label="Mes infos"
              alwaysLabel
            />
            <NavLinkButton
              to="/dashboard"
              icon={<BookOpen className="size-4" />}
              label="Mes menus"
              alwaysLabel
            />
            <NavLinkButton
              to="/apparence"
              icon={<Palette className="size-4" />}
              label="Apparence"
              alwaysLabel
            />
            {role === "admin" && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="clay-sm hidden rounded-2xl border-0 bg-card font-bold sm:inline-flex"
              >
                <Link to="/admin">
                  <ShieldCheck className="size-4" /> Admin
                </Link>
              </Button>
            )}
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
