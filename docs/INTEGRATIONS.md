# Integrations DN MODE

Toutes les cles d'API se saisissent depuis le CRM : **Admin > Parametres**.
Elles sont stockees dans la table `site_config` ; les variables d'environnement
(voir `.env.example`) ne servent que de valeur de repli. Chaque integration
fonctionne en **mode demo** tant qu'aucune cle n'est renseignee : rien ne casse,
les appels externes sont simplement simules ou journalises.

## Mise a jour de la base

Le schema a evolue (colonnes de livraison sur `orders`, champs Sendcloud sur
`shipping_methods`, `google_id`/`provider` sur `users`, `subject`/`admin_reply`
sur `contacts`). Appliquer avant deploiement :

```bash
npm run db:push
```

Le seed cree les 3 methodes de livraison, les gabarits d'emails et la config par
defaut (seuil 100€) :

```bash
npx tsx db/seed.ts    # ou le runner TypeScript du projet
```

Les gabarits d'emails peuvent aussi etre crees depuis le CRM :
**Parametres > Emails transactionnels > Creer les templates par defaut**.

## Sendcloud (Colissimo / Chronopost / Mondial Relay)

`Admin > Parametres > Livraison Sendcloud`

| Champ | Cle `site_config` | Variable d'env |
| --- | --- | --- |
| Public Key | `sendcloud_public_key` | `SENDCLOUD_PUBLIC_KEY` |
| Secret Key | `sendcloud_secret_key` | `SENDCLOUD_SECRET_KEY` |
| ID adresse d'expedition (facultatif) | `sendcloud_sender_address_id` | `SENDCLOUD_SENDER_ADDRESS_ID` |
| Poids par defaut (kg) | `sendcloud_default_weight` | `SENDCLOUD_DEFAULT_WEIGHT` |

Les options d'expedition et la creation des colis passent par l'**API v3**
de Sendcloud : la creation de colis en v2 est fermee aux comptes ouverts
depuis avril 2026 (« Creating parcels via API v2 is not available for this
account »). La recherche de points relais et le suivi restent en v2, toujours
ouverte.

Sans ID d'adresse d'expedition, l'etiquette part de la premiere adresse
francaise du compte Sendcloud (Sendcloud > Parametres > Adresses).

1. Renseigner les cles, puis **Tester la connexion**.
2. Aller dans **Admin > Livraison** et cliquer **Synchroniser depuis Sendcloud** :
   chaque offre du CRM est reliee a l'option Sendcloud correspondante (meme
   transporteur, meme mode domicile / point relais). La colonne « Sendcloud »
   indique l'option retenue, ou « Aucune option » si le compte Sendcloud n'en
   propose pas (les etiquettes seront alors refusees pour cette offre).
   Sans aucune offre en base, la synchronisation en cree une par transporteur
   et par mode.
3. Les offres marquees « Point relais » declenchent le selecteur de point
   relais dans le tunnel de commande.
4. Depuis **Admin > Commandes**, deplier une commande puis
   **Creer l'etiquette Sendcloud** : Sendcloud cherche les options valables
   pour ce colis (destination, point relais choisi, poids reel), le colis est
   annonce avec celle de l'offre, puis le numero de suivi et l'etiquette sont
   enregistres et la commande passe en « Expedie » (ce qui declenche l'email
   d'expedition). **Telecharger l'etiquette** recupere le PDF via le serveur :
   les liens Sendcloud exigent les cles API.

### Offres et options Sendcloud

Une ligne de **Admin > Livraison** est une offre telle que le client la voit
(« Mondial Relay Point Relais »). Elle est reliee a une option d'expedition
Sendcloud, qui couvre toutes les tranches de poids : Sendcloud facture
lui-meme le tarif du poids declare sur l'etiquette.

L'option est choisie automatiquement (la plus standard : sans signature, QR
code, consigne ni retour). On peut en imposer une autre dans la fiche de
l'offre (« Option Sendcloud »), par exemple « Mondial Relay Point Relais QR ».

Les anciennes versions (API v2) importaient une ligne par tranche de poids, a
0 € : la synchronisation les supprime (le CRM affiche un avertissement tant
qu'il en reste).

Sans cles : methodes et points relais de demonstration, generation d'etiquette
refusee avec un message explicite.

## Poids des produits et tarif de livraison

Chaque produit porte un **poids en grammes** (Admin > Produits > Poids), hors
emballage. Le poids du colis vaut la somme des poids des articles commandes,
plus le poids d'emballage configure dans **Parametres > Livraison Sendcloud**
(100 g par defaut). Un produit sans poids retombe sur le poids par defaut.

Ce poids sert a deux choses :

1. **Calculer le prix de livraison.** Chaque offre a une grille « Tarif selon
   le poids du colis » (Admin > Livraison > modifier) : par exemple jusqu'a
   0.5 kg : 4.50 €, jusqu'a 1 kg : 5.50 €, jusqu'a 2 kg : 6.90 €. Le prix
   affiche au checkout et facture a la commande est celui de la tranche du
   colis ; au-dela de la derniere tranche, son prix s'applique. Sans grille,
   l'offre garde un prix unique. Le bouton « Reprendre les tarifs Sendcloud »
   releve le cout Sendcloud de l'option a plusieurs poids (0,25 a 30 kg) et
   pre-remplit la grille, a ajuster ensuite. Une offre n'est masquee que si le
   colis depasse le poids maximal de son option Sendcloud.
2. **Declarer le poids exact du colis** a la creation de l'etiquette, ce qui
   evite les regularisations de facturation du transporteur.

Le poids est fige sur la ligne de commande au moment de l'achat, comme le
prix : modifier ou supprimer un produit ensuite ne change pas les commandes
passees.

## Connexion Gmail (Google OAuth 2.0)

`Admin > Parametres > Connexion Gmail`

| Champ | Cle `site_config` | Variable d'env |
| --- | --- | --- |
| Client ID | `gmail_client_id` | `GOOGLE_CLIENT_ID` |
| Client Secret | `gmail_client_secret` | `GOOGLE_CLIENT_SECRET` |

Dans la console Google Cloud (Identifiants > ID client OAuth), declarer
exactement cette URI de redirection (le CRM l'affiche avec un bouton Copier) :

```
https://<votre-domaine>/api/auth/google/callback
```

Flux : `/login` > « Continuer avec Google » > Google > `/api/auth/google/callback`
> le serveur cree ou relie le compte (par `google_id`, sinon par email) puis
redirige vers `/auth/callback#token=...`, ou le front stocke le jeton.
Le bouton n'apparait sur la page de connexion que si les deux cles sont
renseignees.

## Stockage des images produits

**Rien a configurer.** Par defaut, les photos envoyees depuis le CRM sont
enregistrees dans la base MySQL (table `images`, creee au demarrage du
serveur) et servies par `GET /api/images/<fichier>`. Chaque fichier a un nom
unique et une reponse cachee un an : le CDN d'App Hosting les garde en cache
et la base n'est presque jamais relue. Suffisant pour quelques centaines de
photos.

Avant l'envoi, le navigateur reduit chaque photo a 1600 px de cote et la
reencode en WebP (JPEG sur les navigateurs qui ne savent pas produire de
WebP). Une photo de telephone de plusieurs Mo descend ainsi a quelques
centaines de Ko, ce qui allege la base et accelere la boutique.

### Option : service compatible S3 (gros catalogue)

`Admin > Parametres > Stockage des images`

| Champ | Cle `site_config` | Variable d'env |
| --- | --- | --- |
| Endpoint S3 | `storage_endpoint` | `STORAGE_ENDPOINT` |
| Bucket | `storage_bucket` | `STORAGE_BUCKET` |
| Region | `storage_region` | `STORAGE_REGION` |
| Access Key | `storage_access_key` | `STORAGE_ACCESS_KEY` |
| Secret Key | `storage_secret_key` | `STORAGE_SECRET_KEY` |
| URL publique | `storage_public_url` | `STORAGE_PUBLIC_URL` |

Des que l'endpoint, le bucket et les deux cles sont renseignes, les nouveaux
envois partent vers ce service ; les images deja enregistrees en base restent
servies. Fonctionne avec Google Cloud Storage (mode interoperabilite S3, cles
HMAC), Cloudflare R2, Scaleway Object Storage ou MinIO. Le bucket doit etre
lisible publiquement pour que les photos s'affichent sur la boutique.

### Dans le CRM

**Admin > Produits** accepte le glisser-deposer et la selection de fichiers :
JPEG, PNG, WebP ou AVIF, 8 Mo maximum par image apres reduction. La premiere
image de la liste sert de vignette sur la boutique ; les fleches sous chaque
miniature permettent de reordonner. Une URL peut aussi etre collee a la main.

Le fichier transite par le serveur (`POST /api/upload`, reserve aux
administrateurs) plutot que par une URL pre-signee : cela evite d'avoir a
configurer le CORS d'un bucket.

## Emails transactionnels (Resend)

`Admin > Parametres > Emails transactionnels`

| Champ | Cle `site_config` | Variable d'env |
| --- | --- | --- |
| Resend API Key | `resend_api_key` | `RESEND_API_KEY` |
| Email expediteur | `from_email` | `FROM_EMAIL` |
| Email SAV | `support_email` | `SUPPORT_EMAIL` |

Gabarits fournis (modifiables dans **Admin > Emails**) :

| Cle | Declencheur |
| --- | --- |
| `order_confirmation` | commande creee / paiement confirme |
| `order_shipped` | statut passe a « Expedie » |
| `order_delivered` | statut passe a « Livre » |
| `order_cancelled` | statut passe a « Annule » |
| `sav_acknowledgement` | message envoye depuis le formulaire de contact |
| `sav_reply` | reponse envoyee depuis **Admin > Messages** |
| `welcome` | disponible pour la creation de compte |

Sans cle Resend, les envois sont journalises (`[DEMO EMAIL] ...`) sans jamais
faire echouer une commande.

## Livraison offerte

Seuil et frais par defaut : **Admin > Parametres > Site Web**
(`shipping_threshold` = `100`, `shipping_cost` = `5.90`).

La valeur alimente le bandeau du site (defilant sur mobile), le panier, la fiche
produit, le tunnel de commande et le calcul serveur des frais de port
(`api/lib/shipping.ts`). Changer le seuil dans le CRM le met a jour partout.

## Referencement (SEO)

Rien a configurer pour que ca marche. Le serveur complete le HTML de chaque
page (`api/lib/seo.ts`) avant de l'envoyer, pour que Google, Bing et les
apercus de liens (WhatsApp, Instagram, Facebook) voient le vrai contenu
d'une boutique dont l'affichage se fait en JavaScript :

- **Titre et description** par page. Produit : description courte, sinon
  description, sinon une phrase avec le prix. Collection : description de la
  collection, sinon une phrase generique. Accueil : `Admin > Parametres >
  Site Web > Description (Google)`.
- **URL canonique** sur le domaine officiel : champ « URL du site » du CRM,
  sinon `PUBLIC_APP_URL`, sinon le domaine de la requete.
- **Apercus de liens** (Open Graph) : premiere photo du produit, image de la
  collection ou visuel d'accueil.
- **Donnees structurees** schema.org : fiche produit avec prix, devise,
  disponibilite et photos (resultats enrichis Google), fil d'Ariane,
  organisation avec logo et compte Instagram.
- **Codes HTTP justes** : une adresse inconnue, un produit supprime ou
  desactive dans le CRM repondent 404, pour sortir proprement de Google.
- **Pages privees** (`/admin`, `/checkout`, `/login`) marquees `noindex`.
- **Contenu de secours** dans `<noscript>` (titre, texte, liens) pour les
  robots qui n'executent pas le JavaScript.

`/sitemap.xml` liste l'accueil, les collections, les produits actifs (avec
date de modification et photos) et la page contact. `/robots.txt` y renvoie
et ferme `/admin`, `/checkout` et `/auth/`. `/api/` doit rester ouvert :
Google l'appelle pour afficher les produits, et les photos y sont servies.

Dans le navigateur, `src/hooks/useSeo.ts` garde titre, description et
canonique a jour quand on change de page sans recharger.

### A faire une fois en ligne

1. [Google Search Console](https://search.google.com/search-console) :
   ajouter `dnmode.fr`, verifier par DNS, puis **Sitemaps** > envoyer
   `https://dnmode.fr/sitemap.xml`.
2. Bing Webmaster Tools : importer le site depuis Search Console.
3. Pour chaque produit, remplir la **description courte** (une phrase, 160
   caracteres max) : c'est le texte affiche sous le titre dans Google.

## Securite

Rien a configurer. Ce qui est en place :

- **Mots de passe** haches en scrypt avec un sel propre a chaque compte
  (`api/lib/password.ts`). Les anciens hash SHA-256 sont convertis a la
  connexion suivante, sans reinitialisation. 8 caracteres minimum a
  l'inscription.
- **Tentatives limitees** (`api/lib/rate-limit.ts`) : 10 essais de mot de
  passe par compte et 30 par adresse IP sur 15 minutes, 5 inscriptions par
  heure, 5 messages de contact ou inscriptions newsletter par 10 minutes,
  20 commandes par 10 minutes.
- **Commandes** : quantites entieres de 1 a 99, prix toujours relus en base,
  produits retires de la vente refuses. La confirmation d'une commande sans
  paiement Stripe (mode demo) exige le jeton remis a sa creation.
- **Donnees des clients** : panier, suivi de colis et details de commande ne
  sont accessibles qu'a leur proprietaire ou au CRM. Les erreurs techniques
  ne sont detaillees qu'a l'administrateur.
- **Emails** : les textes saisis par les visiteurs (nom, sujet...) sont
  echappes, les liens pointent toujours vers le domaine officiel.
- **Connexion Google** liee a l'onglet qui l'a commencee (aucun lien
  fabrique par un tiers ne peut connecter un visiteur a un autre compte),
  redirections limitees aux pages du site.
- **En-tetes HTTP** (`api/lib/security-headers.ts`) : Content-Security-Policy,
  HSTS, interdiction d'afficher le site dans un cadre, etc.

Pour ajouter un service externe qui charge un script ou appelle une API
depuis le navigateur (statistiques, chat, pixel publicitaire...), declarer
son domaine dans `api/lib/security-headers.ts` : sinon le navigateur le
bloque.

