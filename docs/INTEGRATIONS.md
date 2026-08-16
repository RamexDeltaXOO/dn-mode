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
| ID adresse d'expedition | `sendcloud_sender_address_id` | `SENDCLOUD_SENDER_ADDRESS_ID` |
| Poids par defaut (kg) | `sendcloud_default_weight` | `SENDCLOUD_DEFAULT_WEIGHT` |

1. Renseigner les cles, puis **Tester la connexion**.
2. Aller dans **Admin > Livraison** et cliquer **Synchroniser depuis Sendcloud** :
   les methodes Colissimo / Chronopost / Mondial Relay livrables en France sont
   importees dans `shipping_methods`.
3. Les methodes marquees « Point relais » declenchent le selecteur de point
   relais dans le tunnel de commande.
4. Depuis **Admin > Commandes**, deplier une commande puis
   **Creer l'etiquette Sendcloud** : le colis est cree, le numero de suivi et
   l'etiquette PDF sont enregistres et la commande passe en « Expedie »
   (ce qui declenche l'email d'expedition).

Sans cles : methodes et points relais de demonstration, generation d'etiquette
refusee avec un message explicite.

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

## Stockage des images produits (compatible S3)

`Admin > Parametres > Stockage des images`

| Champ | Cle `site_config` | Variable d'env |
| --- | --- | --- |
| Endpoint S3 | `storage_endpoint` | `STORAGE_ENDPOINT` |
| Bucket | `storage_bucket` | `STORAGE_BUCKET` |
| Region | `storage_region` | `STORAGE_REGION` |
| Access Key | `storage_access_key` | `STORAGE_ACCESS_KEY` |
| Secret Key | `storage_secret_key` | `STORAGE_SECRET_KEY` |
| URL publique | `storage_public_url` | `STORAGE_PUBLIC_URL` |

Une fois renseigne, **Admin > Produits** accepte le glisser-deposer et la
selection de fichiers : JPEG, PNG, WebP ou AVIF, 8 Mo maximum par image. La
premiere image de la liste sert de vignette sur la boutique ; les fleches
sous chaque miniature permettent de reordonner.

Fonctionne avec Google Cloud Storage (mode interoperabilite S3, cles HMAC),
Cloudflare R2, Scaleway Object Storage ou MinIO. Le bucket doit etre lisible
publiquement pour que les photos s'affichent sur la boutique.

Le fichier transite par le serveur (`POST /api/upload`, reserve aux
administrateurs) plutot que par une URL pre-signee : cela evite d'avoir a
configurer le CORS du bucket. Sans configuration, le formulaire produit reste
utilisable en saisissant des URL a la main.

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
