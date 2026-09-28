import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  Languages,
  Package,
  QrCode,
  ScanLine,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ALLERGENS, cn } from "@/lib/utils";
import {
  PLANS,
  PRO_ANNUAL_GIFT_QTY,
  PRO_PRICE_ANNUAL_EUR,
  PRO_PRICE_EUR,
} from "@/convex/plans";

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="clay-teal clay-sm ring-clay-ring flex size-10 items-center justify-center rounded-2xl">
        <UtensilsCrossed className="size-5 text-white" />
      </div>
      <span className="text-xl font-bold tracking-tight text-clay-deep">
        Menu<span className="text-primary">Maker</span>
      </span>
    </div>
  );
}

function Nav() {
  const { isAuthenticated } = useAuth();
  return (
    <header className="sticky top-0 z-40 px-4 pt-4">
      <nav className="clay-card clay-ring mx-auto flex w-full max-w-6xl items-center justify-between rounded-3xl px-5 py-3 shadow-[0_10px_30px_rgba(96,110,140,0.15)]">
        <Logo />
        <div className="hidden items-center gap-6 text-sm font-semibold text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">Fonctionnalités</a>
          <a href="#pricing" className="hover:text-foreground">Tarifs</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Button asChild className="clay-btn rounded-2xl font-bold">
              <Link to="/dashboard">Mon espace</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden rounded-2xl font-bold sm:inline-flex">
                <Link to="/auth">Connexion</Link>
              </Button>
              <Button asChild className="clay-btn clay-teal rounded-2xl font-bold text-white">
                <Link to="/auth">
                  Essai gratuit
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

// Visuel « scan à table » (photo déposée dans public/images/). Si le fichier
// est absent, la page retombe élégamment sur la composition d'origine.
const SCAN_IMG_SRCS = ["/qrcode-menu.webp", "/images/hero-scanner.jpg", "/images/hero-scanner.png"];

function Hero() {
  const navigate = useNavigate();
  const [scanImgIdx, setScanImgIdx] = useState(0);
  const scanImgOk = scanImgIdx < SCAN_IMG_SRCS.length;
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-14 pb-20 lg:grid-cols-2 lg:pt-20">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-start gap-6"
      >
        <Badge className="clay-in rounded-full border-0 bg-muted px-4 py-1.5 text-sm font-bold text-accent-foreground">
          <Sparkles className="mr-1 size-4 text-primary" />
          Menu digital prêt en 10 minutes
        </Badge>
        <h1 className="font-[Baloo_2] text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
          Vos menus digitaux,{" "}
          <span className="bg-gradient-to-r from-[oklch(0.66_0.13_210)] to-[oklch(0.72_0.14_190)] bg-clip-text text-transparent">
            appétissants & traduits
          </span>
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Photos qui donnent faim, les 14 allergènes réglementaires, traduction
          automatique en anglais, espagnol et allemand, et un QR code imprimable
          pour vos clients. Pensé pour les restaurants, brasseries et food trucks.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            className="clay-btn clay-teal h-12 rounded-2xl px-7 text-base font-bold text-white"
            onClick={() => navigate("/auth")}
          >
            Créer mon menu gratuitement
            <ArrowRight className="size-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="clay-sm h-12 rounded-2xl border-0 bg-card px-7 text-base font-bold"
            onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
          >
            Voir les tarifs
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Check className="size-4 text-primary" /> Sans carte bancaire
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="size-4 text-primary" /> Plan gratuit à vie
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="size-4 text-primary" /> FR / EN / ES / DE
          </span>
        </div>
      </motion.div>

      {/* Scan → menu : la tente QR sur la table et le menu client, côte à côte */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.15 }}
        className="relative mx-auto w-full max-w-xl"
      >
        <div className={`relative flex items-center justify-center ${scanImgOk ? "flex-col gap-5 sm:flex-row sm:gap-0" : ""}`}>
          {/* Photo 1 : tente QR posée sur la table du restaurant (grandit et monte) */}
          {scanImgOk && (
            <motion.div
              initial={{ opacity: 0, x: -24, rotate: -7 }}
              animate={{ opacity: 1, x: 0, rotate: -3.5 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ rotate: -1.5, scale: 1.02 }}
              className="clay relative z-10 w-52 shrink-0 rounded-[1.75rem] bg-card p-2.5 sm:w-64 sm:-translate-y-5"
            >
              <img
                src={SCAN_IMG_SRCS[scanImgIdx]}
                alt="Tente de table avec QR code à scanner"
                onError={() => setScanImgIdx((i) => i + 1)}
                className="aspect-[4/4.4] w-full rounded-[1.25rem] object-cover"
              />
              <span className="clay-btn clay-teal absolute -top-3 -left-2 rounded-full px-3 py-1 text-[11px] font-extrabold text-white">
                1 · On scanne
              </span>
            </motion.div>
          )}

          {/* Pulsation « scan » au niveau de la jonction photo → téléphone */}
          {scanImgOk && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.14, 1] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                className="clay-btn flex size-12 items-center justify-center rounded-full bg-card"
              >
                <ScanLine className="size-5 text-primary" />
              </motion.div>
            </div>
          )}

          {/* Photo 2 : main tenant le téléphone avec le menu client ; fallback : mockup si aucune photo */}
          {scanImgOk ? (
            <motion.div
              initial={{ opacity: 0, x: 24, rotate: 6 }}
              animate={{ opacity: 1, x: 0, rotate: 3 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              whileHover={{ rotate: 1.5, scale: 1.02 }}
              className="clay relative z-10 -ml-8 w-48 shrink-0 rounded-[1.75rem] bg-card p-2.5 sm:w-60 sm:translate-y-6"
            >
              <img
                src="/mobile-menu.webp"
                alt="Menu client affiché sur un téléphone"
                className="aspect-[4/5] w-full rounded-[1.25rem] object-cover"
              />
              <span className="clay-btn absolute -top-3 -right-2 z-20 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-clay-deep">
                2 · Menu affiché
              </span>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="relative"
            >
        <div className={`clay rounded-[2.5rem] bg-card p-4`}>
          <div className="overflow-hidden rounded-[2rem] bg-background">
            <div className="clay-teal flex items-center justify-between px-5 pt-5 pb-8">
              <div>
                <p className="text-xs font-bold text-white/80">CHEZ MARCEL · PARIS 11</p>
                <p className="font-[Baloo_2] text-2xl font-extrabold text-white">Carte du jour</p>
              </div>
              <div className="clay-sm flex size-10 items-center justify-center rounded-2xl bg-white/90 text-lg">🇬🇧</div>
            </div>
            <div className="-mt-4 space-y-3 px-4 pb-5">
              {[
                { e: "🥗", t: "Entrées", n: 2 },
                { e: "🍔", t: "Plats", n: 2 },
                { e: "🍰", t: "Desserts", n: 1 },
              ].map((c, i) => (
                <motion.div
                  key={c.t}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.15 }}
                  className="clay-flat flex items-center gap-3 rounded-2xl bg-card p-3"
                >
                  <div className="clay-in flex size-11 items-center justify-center rounded-xl bg-muted text-xl">
                    {c.e}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{c.t}</p>
                    <p className="text-xs text-muted-foreground">{c.n} plats · photos & allergènes</p>
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </motion.div>
              ))}
              <div className="clay-flat flex items-center gap-3 rounded-2xl bg-card p-3">
                <img
                  src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&q=70"
                  alt="Burger maison"
                  className="size-14 rounded-xl object-cover"
                />
                <div className="flex-1">
                  <p className="text-sm font-bold">Burger maison</p>
                  <p className="text-xs text-muted-foreground">Bœuf Angus, cheddar…</p>
                  <div className="mt-1 flex gap-1 text-[10px]">
                    <span className="rounded-full bg-muted px-1.5">🌾</span>
                    <span className="rounded-full bg-muted px-1.5">🥛</span>
                    <span className="rounded-full bg-muted px-1.5">🥚</span>
                  </div>
                </div>
                <span className="font-[Baloo_2] text-lg font-extrabold text-clay-deep">18 €</span>
              </div>
            </div>
          </div>
        </div>
            </motion.div>
          )}
        </div>

        {!scanImgOk && (
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="clay absolute -top-5 -right-5 flex size-16 items-center justify-center rounded-3xl bg-card"
          >
            <QrCode className="size-8 text-primary" />
          </motion.div>
        )}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 0.6 }}
          className={`clay absolute z-30 flex items-center gap-2 rounded-3xl bg-card px-4 py-2.5 ${scanImgOk ? "-bottom-6 right-0" : "-bottom-4 -left-4"}`}
        >
          <Languages className="size-4 text-primary" />
          <span className="text-sm font-bold">Auto-traduit</span>
        </motion.div>
      </motion.div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: <Camera className="size-6 text-white" />,
      bg: "clay-teal",
      title: "Photos qui donnent faim",
      text: "Ajoutez une photo par plat. Vos clients voient exactement ce qu'ils vont commander — et commandent plus.",
    },
    {
      icon: <Sparkles className="size-6 text-white" />,
      bg: "clay-berry",
      title: "14 allergènes réglementaires",
      text: "Signalez les allergènes (France - règlement INCO 1169/2011) : ils s'affichent clairement sur le menu client.",
    },
    {
      icon: <Languages className="size-6 text-white" />,
      bg: "clay-peach",
      title: "Traduction automatique",
      text: "Du français vers l'anglais, l'espagnol et l'allemand en un clic. Vos plats restent appétissants dans chaque langue.",
    },
    {
      icon: <Smartphone className="size-6 text-white" />,
      bg: "clay-butter",
      title: "Menu client mobile",
      text: "Une page élégante, rapide et responsive, à la charte de votre établissement. Aucune app à installer.",
    },
    {
      icon: <QrCode className="size-6 text-white" />,
      bg: "clay-teal",
      title: "QR code imprimable",
      text: "Téléchargez le QR code de chaque menu et affichez-le sur vos tables, votre vitrine ou votre camion.",
    },
    {
      icon: <UtensilsCrossed className="size-6 text-white" />,
      bg: "clay-berry",
      title: "Catégories & types de menu",
      text: "Carte, menu du jour, carte du soir, menu enfants… Organisez tout par catégories avec emojis.",
    },
  ];
  return (
    <section id="features" className="mx-auto w-full max-w-6xl px-4 py-16">
      <div className="mb-12 text-center">
        <h2 className="font-[Baloo_2] text-3xl font-extrabold sm:text-4xl">
          Tout ce qu'il faut pour un menu{" "}
          <span className="text-primary">qui donne envie</span>
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Conçu avec des restaurateurs : simple à remplir, magnifique pour vos clients.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
          >
            <Card className="clay-card clay-ring clay-flat h-full gap-4 rounded-3xl border-0 py-6">
              <CardContent className="flex flex-col gap-3 px-6">
                <div className={`${it.bg} clay-sm flex size-13 items-center justify-center rounded-2xl`}>
                  {it.icon}
                </div>
                <h3 className="text-lg font-bold">{it.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{it.text}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function AllergenStrip() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="clay rounded-[2.5rem] bg-card p-8 sm:p-10">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <Badge className="clay-in mb-3 rounded-full border-0 bg-muted px-3 py-1 font-bold">
              Conformité France 🇫🇷
            </Badge>
            <h3 className="font-[Baloo_2] text-2xl font-extrabold sm:text-3xl">
              Les 14 allergènes réglementaires, affichés clairement
            </h3>
            <p className="mt-3 text-muted-foreground">
              En France, l'affichage des allergènes est une obligation légale.
              MenuMaker couvre les 14 allergènes du règlement INCO et les rend
              lisibles en un coup d'œil sur le menu de vos clients — en 4 langues.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            {ALLERGENS.map((a: { code: string; labelFr: string; emoji: string }) => (
              <span
                key={a.code}
                className="clay-sm flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-bold"
                title={a.labelFr}
              >
                <span>{a.emoji}</span> {a.labelFr}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  return (
    <section id="pricing" className="mx-auto w-full max-w-5xl px-4 py-16">
      <div className="mb-12 text-center">
        <h2 className="font-[Baloo_2] text-3xl font-extrabold sm:text-4xl">
          Un prix <span className="text-primary">simple et honnête</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Commencez gratuitement. Passez au Pro quand votre carte grandit.
        </p>
      </div>
      {/* Bascule Mensuel / Annuel */}
      <div className="mb-8 flex justify-center">
        <div className="clay-in flex gap-1 rounded-full bg-muted p-1.5">
          <button
            onClick={() => setAnnual(false)}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-bold transition-all",
              !annual ? "clay-btn clay-teal text-white" : "text-muted-foreground",
            )}
          >
            Mensuel
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold transition-all",
              annual ? "clay-btn clay-teal text-white" : "text-muted-foreground",
            )}
          >
            Annuel
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                annual ? "bg-white/90 text-clay-deep" : "clay-butter text-[oklch(0.4_0.08_70)]",
              )}
            >
              2 mois offerts
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="clay-card clay-ring clay-flat rounded-[2rem] border-0">
          <CardContent className="flex h-full flex-col gap-5 p-8">
            <div>
              <h3 className="text-xl font-bold">Gratuit</h3>
              <p className="text-sm text-muted-foreground">Pour tester et petit menu</p>
            </div>
            <p className="font-[Baloo_2] text-5xl font-extrabold">
              0 €<span className="text-lg font-bold text-muted-foreground"> /mois</span>
            </p>
            <ul className="flex-1 space-y-2.5 text-sm">
              {PLANS.FREE.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  {f.startsWith("Aucune") ? (
                    <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                  ) : (
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  )}
                  <span className={f.startsWith("Aucune") ? "text-muted-foreground" : ""}>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="clay-sm h-11 rounded-2xl border-0 bg-muted font-bold"
              onClick={() => navigate("/auth")}
            >
              Commencer gratuitement
            </Button>
          </CardContent>
        </Card>

        <Card className="clay-teal clay-btn relative overflow-hidden rounded-[2rem] border-0">
          <Badge className="absolute top-5 right-5 rounded-full border-0 bg-white/90 px-3 py-1 font-extrabold text-clay-deep">
            Recommandé
          </Badge>
          <CardContent className="flex h-full flex-col gap-5 p-8">
            <div>
              <h3 className="text-xl font-bold text-white">Pro</h3>
              <p className="text-sm text-white/80">Pour grandir sans limite</p>
            </div>
            <p className="font-[Baloo_2] text-5xl font-extrabold text-white">
              {annual ? PRO_PRICE_ANNUAL_EUR : PRO_PRICE_EUR} €
              <span className="text-lg font-bold text-white/80">
                {annual ? " /an" : " /mois"}{" "}
                <span className="align-middle text-xs font-semibold text-white/60">
                  (hors TVA)
                </span>
              </span>
            </p>
            {annual && (
              <div className="flex items-start gap-2 rounded-2xl bg-white/15 p-3 text-sm text-white">
                <Package className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong>Cadeau de bienvenue :</strong> {PRO_ANNUAL_GIFT_QTY} porte-cartes
                  QR à l'effigie de votre restaurant, expédiés par colis sous 2
                  semaines après le paiement.
                </span>
              </div>
            )}
            <ul className="flex-1 space-y-2.5 text-sm text-white">
              {PLANS.PRO.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="h-11 rounded-2xl border-0 bg-white font-bold text-clay-deep hover:bg-white/90"
              onClick={() =>
                navigate(
                  annual
                    ? `/auth?returnTo=${encodeURIComponent("/subscription?cycle=annual")}`
                    : "/auth",
                )
              }
            >
              {annual ? "Passer au Pro — 190 €/an" : "Passer au Pro"}
            </Button>
          </CardContent>
        </Card>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Sans engagement. Résiliable à tout moment depuis votre espace.
      </p>
    </section>
  );
}

function Faq() {
  const qa = [
    {
      q: "Mes clients doivent-ils installer une application ?",
      a: "Non. Ils scannent le QR code affiché sur table et votre menu s'ouvre directement dans leur navigateur, en français, anglais, espagnol ou allemand.",
    },
    {
      q: "Comment fonctionne la traduction automatique ?",
      a: "Vous rédigez vos plats en français, puis cliquez sur « Traduire ». Nos modèles traduisent noms et descriptions vers l'anglais, l'espagnol et l'allemand, avec un vocabulaire culinaire naturel. Inclus dans le plan Pro.",
    },
    {
      q: "L'affichage des allergènes est-il conforme ?",
      a: "Oui, MenuMaker couvre les 14 allergènes à déclaration obligatoire en France (règlement UE INCO 1169/2011). Vous les cochez une fois par plat, ils s'affichent clairement pour vos clients.",
    },
    {
      q: "Puis-je mettre à jour mon menu à tout moment ?",
      a: "Absolument. Modifiez un prix ou un plat, et le menu digital de vos clients se met à jour instantanément. Plus besoin de réimprimer quoi que ce soit.",
    },
    {
      q: "Le plan gratuit est-il vraiment gratuit ?",
      a: "Oui : 1 menu, une photo par plat, les 14 allergènes et le QR code imprimable, sans limite de durée et sans carte bancaire. La traduction automatique et les menus illimités sont réservés au plan Pro.",
    },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="mx-auto w-full max-w-3xl px-4 py-16">
      <h2 className="mb-10 text-center font-[Baloo_2] text-3xl font-extrabold sm:text-4xl">
        Questions fréquentes
      </h2>
      <div className="space-y-3">
        {qa.map((item, i) => (
          <div key={item.q} className="clay-flat overflow-hidden rounded-3xl bg-card">
            <button
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left font-bold"
              onClick={() => setOpen(open === i ? -1 : i)}
            >
              {item.q}
              <ChevronDown
                className={`size-5 shrink-0 text-primary transition-transform ${open === i ? "rotate-180" : ""}`}
              />
            </button>
            {open === i && (
              <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaBanner() {
  const navigate = useNavigate();
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20">
      <div className="clay-teal clay relative overflow-hidden rounded-[2.5rem] px-8 py-14 text-center">
        <div className="pointer-events-none absolute -top-10 -left-10 size-40 rounded-full bg-white/15" />
        <div className="pointer-events-none absolute -right-14 -bottom-14 size-56 rounded-full bg-white/10" />
        <h2 className="relative font-[Baloo_2] text-3xl font-extrabold text-white sm:text-4xl">
          Prêt à digitaliser votre carte ?
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-white/90">
          Créez votre compte, ajoutez vos plats, imprimez votre QR code.
          Vos clients scannent, vous brillez.
        </p>
        <Button
          size="lg"
          className="relative mt-8 h-12 rounded-2xl border-0 bg-white px-8 text-base font-bold text-clay-deep hover:bg-white/90"
          onClick={() => navigate("/auth")}
        >
          Essayer MenuMaker gratuitement
          <ArrowRight className="size-5" />
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
        <Logo />
        <p>© {new Date().getFullYear()} MenuMaker — Menus digitaux pour restaurateurs.</p>
        <div className="flex gap-4 font-semibold">
          <a href="#features" className="hover:text-foreground">Fonctionnalités</a>
          <a href="#pricing" className="hover:text-foreground">Tarifs</a>
          <Link to="/auth" className="hover:text-foreground">Connexion</Link>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex-1">
        <Hero />
        <Features />
        <AllergenStrip />
        <Pricing />
        <Faq />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}
