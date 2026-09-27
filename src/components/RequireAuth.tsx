import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

/**
 * Protège une route réservée aux utilisateurs connectés.
 *
 * Les visiteurs non connectés voient un message clair sur la page demandée,
 * puis reviennent dessus après connexion via `returnTo`. Passer
 * `redirectImmediately` pour rediriger tout de suite vers `/auth`.
 */
export function RequireAuth({
  children,
  title = "Connectez-vous pour continuer",
  description = "Cette page est réservée aux restaurateurs connectés.",
  redirectImmediately = false,
}: {
  children: ReactNode;
  /** Titre de l'écran de blocage. */
  title?: string;
  /** Ce que le visiteur obtient en se connectant. */
  description?: string;
  /** Rediriger immédiatement vers `/auth` sans explication. */
  redirectImmediately?: boolean;
}) {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    const signInHref = `/auth?returnTo=${encodeURIComponent(returnTo)}`;

    if (redirectImmediately) {
      return <Navigate to={signInHref} replace />;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="clay clay-card w-full max-w-md rounded-3xl border-0 shadow-none">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <div className="clay-in mb-4 flex size-12 items-center justify-center rounded-3xl bg-muted">
                <Lock className="size-5 text-muted-foreground" />
              </div>
            </div>
            <CardTitle className="font-[Baloo_2] text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            Vous serez ramené directement sur cette page après connexion.
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button className="clay-btn clay-teal h-11 w-full rounded-2xl font-bold text-white" onClick={() => navigate(signInHref)}>
              Se connecter
            </Button>
            <Button
              variant="ghost"
              className="w-full rounded-2xl font-bold"
              onClick={() => navigate("/")}
            >
              Retour à l'accueil
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return children;
}
