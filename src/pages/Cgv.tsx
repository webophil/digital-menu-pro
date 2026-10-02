import { BrandLogo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  CalendarClock,
  CreditCard,
  Euro,
  FileText,
  Gavel,
  Lock,
  Receipt,
  Scale,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="clay-card clay-flat rounded-3xl border-0">
      <CardHeader className="gap-1.5 pb-3">
        <CardTitle className="flex items-center gap-2.5 font-[Baloo_2] text-lg">
          <span className="clay-in flex size-9 items-center justify-center rounded-2xl bg-muted">
            {icon}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}

export default function Cgv() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 px-4 pt-4">
        <nav className="clay-card clay-ring mx-auto flex w-full max-w-6xl items-center justify-between rounded-3xl px-5 py-3 shadow-[0_10px_30px_rgba(96,110,140,0.15)]">
          <Link to="/" aria-label="Retour à l'accueil">
            <BrandLogo className="h-9 w-auto" />
          </Link>
          <Button
            asChild
            variant="ghost"
            className="rounded-2xl font-bold text-muted-foreground"
          >
            <Link to="/">
              <ArrowLeft className="size-4" /> Retour au site
            </Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <div className="mb-8 text-center">
          <div className="clay-teal mx-auto mb-4 flex size-14 items-center justify-center rounded-3xl">
            <Receipt className="size-7 text-white" />
          </div>
          <h1 className="font-[Baloo_2] text-3xl font-extrabold sm:text-4xl">
            Conditions Générales de Vente
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Conditions applicables aux abonnements au service V'la le Menu ! —
            menus digitaux pour restaurateurs (vlalemenu.fr).
          </p>
        </div>

        <div className="space-y-5">
          <Section icon={<UserRound className="size-4 text-muted-foreground" />} title="Vendeur / éditeur du service">
            <p>
              <strong className="text-foreground">V'la le Menu !</strong>, service édité par{" "}
              <strong className="text-foreground">PhilDEV — Philippe PERARD</strong>
              <br />
              Entrepreneur individuel (micro-entrepreneur)
              <br />
              37 rue Hincmar — 51100 Reims, France
            </p>
            <p>
              N° SIRET : <strong className="text-foreground">325 342 418 00051</strong>
              <br />
              Contact : <strong className="text-foreground">contact@vlalemenu.fr</strong> — via la{" "}
              <Link to="/contact" className="font-semibold text-primary underline underline-offset-2">
                page Contact
              </Link>
              .
            </p>
          </Section>

          <Section icon={<FileText className="size-4 text-muted-foreground" />} title="Objet">
            <p>
              Les présentes Conditions Générales de Vente (CGV) régissent la
              souscription et l'utilisation des abonnements au service V'la le
              Menu ! : création, gestion, mise à jour et diffusion de menus
              digitaux consultables par QR code (page client mobile, traduction,
              allergènes, apparence personnalisée).
            </p>
            <p>
              Le service s'adresse exclusivement à une clientèle de
              professionnels (restaurants, brasseries, cafés, food trucks et
              assimilés). Toute souscription d'abonnement implique
              l'acceptation sans réserve des présentes CGV, accessibles à tout
              moment depuis le site.
            </p>
          </Section>

          <Section icon={<Euro className="size-4 text-muted-foreground" />} title="Tarifs & TVA">
            <p>
              Les tarifs sont affichés en euros et s'entendent{" "}
              <strong className="text-foreground">nets de taxe (hors taxes)</strong> :
              aucune TVA n'est ajoutée au montant facturé, l'exploitant étant
              micro-entrepreneur non assujetti à la TVA.
            </p>
            <p>
              <strong className="text-foreground">
                TVA non applicable, art. 293 B du CGI
              </strong>{" "}
              — depuis le 1er septembre 2026, la nouvelle référence est{" "}
              <strong className="text-foreground">
                « TVA non applicable, art. L. 223-3 du Code des impositions sur
                les biens et services (CIBS) »
              </strong>
              . Pendant la période transitoire (au moins jusqu'en 2027), les
              deux mentions coexistent et sont annoncées en parallèle sur les
              factures et les supports du service.
            </p>
            <p>
              Offres en vigueur : plan <strong className="text-foreground">Gratuit</strong>{" "}
              (0 €) et plan <strong className="text-foreground">Pro</strong>{" "}
              (19 €/mois ou 190 €/an, soit 2 mois offerts). Le tarif souscrit
              reste garanti pendant toute la durée de l'abonnement en cours.
            </p>
          </Section>

          <Section icon={<CreditCard className="size-4 text-muted-foreground" />} title="Abonnement & paiement">
            <p>
              L'abonnement Pro est proposé en <strong className="text-foreground">paiement
              mensuel</strong> (19 €) ou <strong className="text-foreground">paiement annuel</strong>{" "}
              (190 €). Le paiement est effectué par carte bancaire via la
              plateforme sécurisée <strong className="text-foreground">Stripe</strong> ;
              le service ne stocke aucune donnée bancaire.
            </p>
            <p>
              L'abonnement est souscrit pour la période choisie et se{" "}
              <strong className="text-foreground">reconduit tacitement</strong> aux
              mêmes conditions tant qu'il n'est pas résilié.
            </p>
          </Section>

          <Section icon={<CalendarClock className="size-4 text-muted-foreground" />} title="Durée & résiliation">
            <p>
              La période mensuelle court sur 1 mois, la période annuelle sur 12
              mois, à compter du paiement.
            </p>
            <p>
              L'abonnement est <strong className="text-foreground">sans engagement</strong> :
              il peut être résilié à tout moment, sans frais, depuis l'espace
              client.
            </p>
            <p>
              La résiliation ne coupe pas l'accès immédiatement : le
              restaurateur <strong className="text-foreground">bénéficie des avantages Pro
              jusqu'à la fin de la période déjà payée</strong>. Exemple : pour un
              renouvellement prévu le 20 octobre, une résiliation demandée le
              23 septembre conserve le statut Pro jusqu'au 20 octobre.
            </p>
            <p>
              À l'issue de cette période, le compte repasse automatiquement au
              plan Gratuit (1 menu, sans traduction automatique). Aucun
              remboursement au prorata n'est dû, l'accès aux fonctionnalités
              Pro se poursuivant jusqu'à la fin de la période payée.
            </p>
          </Section>

          <Section icon={<Receipt className="size-4 text-muted-foreground" />} title="Facturation">
            <p>
              Une facture est émise pour chaque paiement et reste accessible
              dans l'espace client (rubrique « Abonnement »). Les factures
              portent la mention « TVA non applicable » avec la référence
              légale indiquée à la section Tarifs &amp; TVA.
            </p>
          </Section>

          <Section icon={<ShieldCheck className="size-4 text-muted-foreground" />} title="Rétractation">
            <p>
              Le service est réservé aux professionnels agissant dans le cadre
              de leur activité commerciale. Conformément à l'article L. 221-3
              du Code de la consommation, les dispositions relatives au droit
              de rétractation ne s'appliquent pas aux présentes ventes.
            </p>
          </Section>

          <Section icon={<Scale className="size-4 text-muted-foreground" />} title="Service & responsabilité">
            <p>
              Le service est fourni avec diligence et selon les règles de
              l'art ; des interruptions de maintenance ponctuelles restent
              possibles. Les traductions automatiques sont fournies en guise
              d'aide à la traduction : leur vérification par le restaurateur
              reste recommandée avant diffusion à sa clientèle.
            </p>
            <p>
              Les contenus saisis (menus, plats, photos, textes) restent la
              propriété du restaurateur. L'éditeur reste propriétaire de la
              plateforme, de sa charte et de ses éléments distinctifs. En tout
              état de cause, la responsabilité de l'éditeur ne saurait excéder
              les montants effectivement versés au titre de l'abonnement en
              cours.
            </p>
          </Section>

          <Section icon={<Lock className="size-4 text-muted-foreground" />} title="Données personnelles">
            <p>
              Les données collectées dans le cadre du service (comptes,
              établissements, menus, facturation) sont traitées conformément au
              RGPD, comme décrit dans notre{" "}
              <Link
                to="/politique-confidentialite"
                className="font-semibold text-primary underline underline-offset-2"
              >
                politique de confidentialité
              </Link>
              .
            </p>
          </Section>

          <Section icon={<Gavel className="size-4 text-muted-foreground" />} title="Droit applicable & litiges">
            <p>
              Les présentes CGV sont soumises au droit français. En cas de
              litige, une solution amiable sera recherchée en priorité
              (contact@vlalemenu.fr). À défaut d'accord, les tribunaux français
              seront seuls compétents.
            </p>
            <p>
              Les clients étant des professionnels (commerçants), les
              dispositions protectrices du Code de la consommation — notamment
              la médiation de la consommation (art. L. 616-1) — ne leur sont
              pas applicables.
            </p>
          </Section>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Dernière mise à jour : octobre 2026.
        </p>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} V'la le Menu ! — Menus digitaux pour
        restaurateurs ·{" "}
        <Link to="/mentions-legales" className="font-semibold hover:text-foreground">
          Mentions légales
        </Link>{" "}
        ·{" "}
        <Link to="/politique-confidentialite" className="font-semibold hover:text-foreground">
          Politique de confidentialité
        </Link>
      </footer>
    </div>
  );
}
