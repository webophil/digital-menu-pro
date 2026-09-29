import { BrandLogo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Database, Gavel, Mail, Server, UserRound } from "lucide-react";
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

export default function MentionsLegales() {
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
            <Gavel className="size-7 text-white" />
          </div>
          <h1 className="font-[Baloo_2] text-3xl font-extrabold sm:text-4xl">
            Mentions légales
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Informations légales relatives au site vlalemenu.fr, conformément à
            la loi n° 2004-575 du 21 juin 2004 pour la confiance dans
            l'économie numérique (LCEN).
          </p>
        </div>

        <div className="space-y-5">
          <Section icon={<UserRound className="size-4 text-muted-foreground" />} title="Éditeur du site">
            <p>
              <strong className="text-foreground">PhilDEV — Philippe PERARD</strong>
              <br />
              Entrepreneur individuel (micro-entrepreneur)
              <br />
              37 rue Hincmar — 51100 Reims, France
            </p>
            <p>
              N° SIRET : <strong className="text-foreground">325 342 418 00051</strong>
              <br />
              TVA non applicable, art. 293 B du CGI.
            </p>
            <p className="flex items-center gap-1.5">
              <Mail className="size-3.5 shrink-0" />
              Contact : contact@vlalemenu.fr — via la{" "}
              <Link to="/contact" className="font-semibold text-primary underline underline-offset-2">
                page Contact
              </Link>
              .
            </p>
            <p>
              Responsable de la publication : Philippe PERARD.
            </p>
          </Section>

          <Section icon={<Server className="size-4 text-muted-foreground" />} title="Hébergement du site">
            <p>
              Le site est hébergé par :
            </p>
            <p>
              <strong className="text-foreground">Vercel Inc.</strong>
              <br />
              440 N Barranca Ave #4133, Covina, CA 91723, États-Unis
              <br />
              <a
                href="https://vercel.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline underline-offset-2"
              >
                vercel.com
              </a>
            </p>
            <p>
              Le site est servi depuis le réseau edge mondial de Vercel,
              incluant des points de présence en Europe (dont Paris). Vercel
              agit en qualité d'hébergeur au sens de la LCEN et a signé un
              accord de traitement des données (DPA) incluant les clauses
              contractuelles types approuvées par la Commission européenne
              pour les transferts de données hors Union européenne.
            </p>
            <p>
              L'envoi des e-mails transactionnels (codes de connexion,
              notifications de contact) est assuré par{" "}
              <strong className="text-foreground">Resend, Inc.</strong>
              (États-Unis), dont l'infrastructure d'envoi s'appuie sur Amazon
              Web Services en Irlande (région eu-west-1, Union européenne).
            </p>
          </Section>

          <Section icon={<Database className="size-4 text-muted-foreground" />} title="Stockage des données">
            <p>
              Les données saisies sur la plateforme (comptes, établissements,
              menus, plats, messages de contact) sont stockées et traitées sur
              les serveurs cloud de :
            </p>
            <p>
              <strong className="text-foreground">Convex, Inc.</strong>
              <br />
              2261 Market Street, San Francisco, CA 94114, États-Unis
              <br />
              <a
                href="https://www.convex.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline underline-offset-2"
              >
                convex.dev
              </a>
            </p>
            <p>
              Convex applique le cadre{" "}
              <strong className="text-foreground">EU‑US Data Privacy Framework</strong>{" "}
              (certification au 10 juillet 2023) pour les transferts de données
              depuis l'Union européenne vers les États-Unis, garantissant un
              niveau de protection adéquat au sens du RGPD. Les photos de plats
              sont stockées sur le stockage objet de Convex, chiffrées au repos.
            </p>
          </Section>

          <Section icon={<Gavel className="size-4 text-muted-foreground" />} title="Propriété intellectuelle">
            <p>
              L'ensemble des contenus du site (textes, visuels, logo, charte
              graphique, code) est la propriété exclusive de PhilDEV /
              Philippe PERARD, sauf mention contraire. Toute reproduction,
              représentation ou exploitation, totale ou partielle, sans
              autorisation écrite préalable est interdite et constituerait une
              contrefaçon sanctionnée par les articles L.335‑2 et suivants du
              Code de la propriété intellectuelle.
            </p>
          </Section>

          <Section icon={<Database className="size-4 text-muted-foreground" />} title="Données personnelles & RGPD">
            <p>
              Les données collectées via le site le sont uniquement pour
              fournir le service (création de compte, gestion des menus,
              facturation) ou répondre aux demandes de contact. Elles ne sont
              ni vendues, ni cédées à des tiers à des fins commerciales.
            </p>
            <p>
              Conformément au Règlement général sur la protection des données
              (RGPD) et à la loi Informatique et Libertés, vous disposez d'un
              droit d'accès, de rectification, d'effacement et de portabilité
              de vos données. Pour l'exercer, écrivez à{" "}
              <strong className="text-foreground">contact@vlalemenu.fr</strong>.
              Les données des comptes sont conservées pendant la durée de
              l'abonnement puis supprimées à la demande ou après un délai
              maximal de 12 mois suivant la fermeture du compte.
            </p>
          </Section>

          <Section icon={<Server className="size-4 text-muted-foreground" />} title="Cookies & traceurs">
            <p>
              <strong className="text-foreground">
                Site sans cookies publicitaires — analytics respectueux de la
                vie privée.
              </strong>{" "}
              Le suivi du référencement s'appuie exclusivement sur la Google
              Search Console (exploration des pages, sans dépôt de cookie ni
              traceur chez les visiteurs). Les polices de caractères sont
              hébergées directement sur le site : aucune requête tierce n'est
              émise lors de la visite. Seuls des éléments techniques
              strictement nécessaires au fonctionnement du service (session de
              connexion, sécurité) sont utilisés, conformément aux
              recommandations de la CNIL — aucun bandeau de consentement
              n'est requis. Détails dans notre{" "}
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
              Le service proposé sur le présent site s'adresse exclusivement à
              une clientèle de professionnels (restaurants, brasseries, cafés,
              food trucks et assimilés). Les conditions d'utilisation et les
              relations contractuelles entre l'éditeur et ses clients
              professionnels sont régies par le droit français.
            </p>
            <p>
              Les clients étant des commerçants agissant dans le cadre de leur
              activité professionnelle, les dispositions protectrices du Code
              de la consommation (notamment la médiation de la consommation,
              art. L.616‑1) ne leur sont pas applicables. En cas de litige, et
              à défaut de résolution amiable préalable (contact@vlalemenu.fr),
              les tribunaux français seront seuls compétents.
            </p>
          </Section>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Dernière mise à jour : septembre 2026.
        </p>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} V'la le Menu ! — Menus digitaux pour
        restaurateurs ·{" "}
        <Link to="/politique-confidentialite" className="font-semibold hover:text-foreground">
          Politique de confidentialité
        </Link>
      </footer>
    </div>
  );
}
