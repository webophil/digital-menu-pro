import { BrandLogo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Clock,
  Cookie,
  Database,
  Globe2,
  Lock,
  Scale,
  ShieldCheck,
  UserRound,
  Users,
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

function Processor({
  name,
  role,
  data,
  guard,
}: {
  name: string;
  role: string;
  data: string;
  guard?: string;
}) {
  return (
    <div className="clay-flat rounded-2xl bg-card p-4">
      <p className="font-bold text-foreground">
        {name} <span className="font-normal">— {role}</span>
      </p>
      <p className="mt-1">Données concernées : {data}</p>
      {guard && (
        <p className="mt-1">
          Garanties : <span className="text-foreground">{guard}</span>
        </p>
      )}
    </div>
  );
}

export default function PolitiqueConfidentialite() {
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
            <ShieldCheck className="size-7 text-white" />
          </div>
          <h1 className="font-[Baloo_2] text-3xl font-extrabold sm:text-4xl">
            Politique de confidentialité
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Comment V'la le Menu ! collecte, utilise et protège vos données
            personnelles, conformément au RGPD (règlement UE 2016/679) et à la
            loi Informatique et Libertés.
          </p>
        </div>

        <div className="space-y-5">
          <Section icon={<UserRound className="size-4 text-muted-foreground" />} title="Responsable du traitement">
            <p>
              Le responsable du traitement des données collectées sur
              vlalemenu.fr est :
            </p>
            <p>
              <strong className="text-foreground">PhilDEV — Philippe PERARD</strong>
              <br />
              37 rue Hincmar — 51100 Reims, France
              <br />
              SIRET 325 342 418 00051
            </p>
            <p>
              Toute demande relative à vos données peut lui être adressée à{" "}
              <strong className="text-foreground">contact@vlalemenu.fr</strong>{" "}
              ou via la{" "}
              <Link to="/contact" className="font-semibold text-primary underline underline-offset-2">
                page Contact
              </Link>
              . Une réponse vous sera apportée dans un délai maximal d'un mois
              (art. 12-3 du RGPD).
            </p>
          </Section>

          <Section icon={<Database className="size-4 text-muted-foreground" />} title="Données collectées et finalités">
            <p>
              <strong className="text-foreground">Compte restaurateur</strong> —
              email de connexion (code à usage unique), nom et type
              d'établissement, ville, adresse, téléphone, SIRET. Finalité :
              création et gestion de votre compte, facturation de l'abonnement.
              Base légale : exécution du contrat.
            </p>
            <p>
              <strong className="text-foreground">Contenu des menus</strong> —
              plats, descriptions, prix, allergènes, photos. Finalité :
              fourniture du service de menu digital. Ces contenus sont publiés
              publiquement sur la page de votre menu (lien /m/…), car c'est
              leur finalité. Base légale : exécution du contrat.
            </p>
            <p>
              <strong className="text-foreground">Messages de contact</strong> —
              nom et prénom, email, établissement (facultatif), sujet, message.
              Finalité : répondre à votre demande. Base légale : mesures
              précontractuelles prises à votre demande.
            </p>
            <p>
              <strong className="text-foreground">Paiement & facturation</strong>{" "}
              — l'ensemble des opérations bancaires est traité par Stripe
              ( Prestataire certifié PCI-DSS). Nous ne collectons ni ne
              stockons jamais vos données de carte bancaire. Nous conservons
              uniquement l'identifiant d'abonnement Stripe et les factures
              (numéro, montant, date) qui nous sont nécessaires. Base légale :
              contrat et obligation légale (conservation des pièces
              comptables, 10 ans).
            </p>
            <p>
              Aucune donnée n'est vendue, louée ou cédée à des tiers à des fin
              publicitaire ou de revente.
            </p>
          </Section>

          <Section icon={<Users className="size-4 text-muted-foreground" />} title="Destinataires et sous-traitants">
            <p>
              Vos données sont traitées par nos seuls sous-traitants
              techniques, encadrés par des accords de traitement des données :
            </p>
            <div className="space-y-3 pt-1">
              <Processor
                name="Vercel Inc."
                role="hébergement du site"
                data="pages du site, journaux techniques"
                guard="DPA signé + clauses contractuelles types (transferts hors UE)"
              />
              <Processor
                name="Convex, Inc."
                role="base de données, stockage des photos, authentification"
                data="comptes, établissements, menus, factures, messages"
                guard="Certifié EU-US Data Privacy Framework"
              />
              <Processor
                name="Resend, Inc."
                role="envoi des e-mails transactionnels"
                data="adresse email (codes de connexion, notifications de contact)"
                guard="Infrastructure d'envoi en Union européenne (AWS Irlande) + DPA"
              />
              <Processor
                name="Stripe, Inc."
                role="paiement et gestion des abonnements"
                data="email, montant, identifiants d'abonnement (jamais les données bancaires complètes)"
                guard="Certifié PCI-DSS niveau 1 + DPA"
              />
              <Processor
                name="OpenAI (via la plateforme d'intégration)"
                role="traduction automatique des plats (plan Pro)"
                data="textes des plats uniquement (noms et descriptions) — aucune donnée personnelle n'est transmise"
                guard="API sans réutilisation des données pour l'entraînement"
              />
            </div>
          </Section>

          <Section icon={<Globe2 className="size-4 text-muted-foreground" />} title="Transferts hors Union européenne">
            <p>
              Certains prestataires sont établis aux États-Unis (Vercel,
              Convex, Resend, Stripe, OpenAI). Ces transferts sont encadrés par
              une décision d'adéquation (EU-US Data Privacy Framework, pour
              Convex) ou par des clauses contractuelles types approuvées par la
              Commission européenne, assorties de mesures techniques
              complémentaires (chiffrement, minimisation). L'envoi des e-mails
              et le stockage des photos s'effectuent en Union européenne.
            </p>
          </Section>

          <Section icon={<Clock className="size-4 text-muted-foreground" />} title="Durées de conservation">
            <p>
              <strong className="text-foreground">Compte & menus</strong> :
              pendant toute la durée de l'abonnement, puis suppression à la
              demande ou au plus tard 12 mois après la fermeture du compte.
            </p>
            <p>
              <strong className="text-foreground">Factures</strong> : 10 ans
              (obligation comptable, art. L123-22 du Code de commerce).
            </p>
            <p>
              <strong className="text-foreground">Messages de contact</strong> :
              le temps nécessaire au traitement de votre demande, au plus 12
              mois.
            </p>
            <p>
              <strong className="text-foreground">Codes de connexion</strong> :
              15 minutes (durée de validité du code à usage unique).
            </p>
          </Section>

          <Section icon={<Cookie className="size-4 text-muted-foreground" />} title="Cookies et traceurs">
            <p>
              <strong className="text-foreground">
                Site sans cookies publicitaires — analytics respectueux de la
                vie privée.
              </strong>
            </p>
            <p>
              Le site n'utilise <strong className="text-foreground">aucun
              cookie publicitaire, aucun traceur d'analyse d'audience tiers ni
              aucun réseau social</strong>, et ne stocke rien sur votre
              appareil à des fins de mesure d'audience. Le suivi du
              référencement s'appuie exclusivement sur la Google Search
              Console, qui fonctionne par exploration des pages (le robot de
              Google lit le site) et ne dépose <strong className="text-foreground">aucun cookie ni
              traceur</strong> chez les visiteurs.
            </p>
            <p>
              Les seuls éléments techniques utilisés sont strictement
              nécessaires au fonctionnement du service (session de connexion
              sécurisée, protection contre la falsification de requêtes) —
              exemptés de consentement au sens des recommandations de la CNIL.
              Les polices de caractères sont <strong className="text-foreground">hébergées
              directement sur le site</strong> : aucune requête n'est envoyée
              à un tiers lors de votre visite. C'est pourquoi aucun bandeau
              cookies ne s'affiche sur le site.
            </p>
          </Section>

          <Section icon={<Lock className="size-4 text-muted-foreground" />} title="Sécurité des données">
            <p>
              Les échanges sont chiffrés (HTTPS/TLS). La connexion se fait par
              code à usage unique envoyé par email : aucun mot de passe n'est
              stocké. Les photos sont converties et stockées en format WebP sur
              le stockage objet chiffré de Convex. L'accès aux données est
              limité au strict nécessaire (principe de minimisation), et les
              fonctions sensibles (paiement, administration) sont protégées par
              vérification serveur systématique.
            </p>
          </Section>

          <Section icon={<Scale className="size-4 text-muted-foreground" />} title="Vos droits & réclamation">
            <p>
              Vous disposez des droits suivants sur vos données personnelles :
              <strong className="text-foreground"> accès</strong>,{" "}
              <strong className="text-foreground">rectification</strong>,{" "}
              <strong className="text-foreground">effacement</strong>,{" "}
              <strong className="text-foreground">portabilité</strong>,{" "}
              <strong className="text-foreground">limitation du traitement</strong>{" "}
              et <strong className="text-foreground">opposition</strong>{" "}
              (art. 15 à 21 du RGPD), ainsi que le droit de retirer votre
              consentement à tout moment lorsqu'il constitue la base légale.
            </p>
            <p>
              Pour exercer ces droits, écrivez à{" "}
              <strong className="text-foreground">contact@vlalemenu.fr</strong>{" "}
              (ou via la{" "}
              <Link to="/contact" className="font-semibold text-primary underline underline-offset-2">
                page Contact
              </Link>
              ). Vous pouvez également introduire une réclamation auprès de la{" "}
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline underline-offset-2"
              >
                CNIL
              </a>{" "}
              (3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07), l'autorité
              française de protection des données.
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
        <Link to="/mentions-legales" className="font-semibold hover:text-foreground">
          Mentions légales
        </Link>
      </footer>
    </div>
  );
}
