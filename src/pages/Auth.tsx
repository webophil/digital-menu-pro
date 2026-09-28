import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Mail, UtensilsCrossed } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer le code. Réessayez.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("Le code saisi est incorrect.");
      setOtp("");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Décor pastel */}
      <div className="pointer-events-none absolute top-16 -left-20 size-72 rounded-full bg-[oklch(0.82_0.1_55)]/40 blur-2xl" />
      <div className="pointer-events-none absolute right-10 bottom-24 size-80 rounded-full bg-[oklch(0.72_0.14_200)]/30 blur-2xl" />

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 flex items-center justify-center gap-2">
            <div className="clay-teal clay-sm flex size-11 items-center justify-center rounded-2xl">
              <UtensilsCrossed className="size-5 text-white" />
            </div>
            <span className="text-xl font-bold text-clay-deep">
              V'la le&nbsp;<span className="text-primary">Menu&nbsp;!</span>
            </span>
          </Link>

          <Card className="clay-card clay rounded-3xl border-0 shadow-none">
            {step === "signIn" ? (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="font-[Baloo_2] text-2xl">
                    Bienvenue 👋
                  </CardTitle>
                  <CardDescription>
                    Connectez-vous ou créez votre compte restaurateur — c'est
                    gratuit, sans carte bancaire.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent className="flex flex-col gap-4">
                    <div className="relative">
                      <Mail className="absolute top-3 left-3 size-4 text-muted-foreground" />
                      <Input
                        name="email"
                        placeholder="vous@mon-restaurant.fr"
                        type="email"
                        className="clay-in h-11 rounded-2xl border-0 bg-muted pl-9"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="clay-btn clay-teal h-11 rounded-2xl font-bold text-white"
                    >
                      {isLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          Recevoir mon code
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Un code à 6 chiffres vous sera envoyé par email. Pas de
                      mot de passe à retenir.
                    </p>
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="font-[Baloo_2] text-2xl">
                    Vérifiez votre boîte mail
                  </CardTitle>
                  <CardDescription>
                    Nous avons envoyé un code à {step.email}
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="flex flex-col items-center gap-4">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) form.requestSubmit();
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Pas reçu ?{" "}
                      <Button
                        variant="link"
                        className="h-auto p-0 font-bold text-primary"
                        onClick={() => setStep("signIn")}
                      >
                        Renvoyer le code
                      </Button>
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    <Button
                      type="submit"
                      disabled={isLoading || otp.length !== 6}
                      className="clay-btn clay-teal h-11 w-full rounded-2xl font-bold text-white"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Vérification…
                        </>
                      ) : (
                        <>
                          Confirmer
                          <ArrowRight className="ml-2 size-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="w-full rounded-2xl font-bold"
                    >
                      Utiliser un autre email
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}
          </Card>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/" className="font-semibold text-primary hover:underline">
              ← Retour à l'accueil
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
