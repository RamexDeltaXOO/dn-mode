# Mettre DN MODE en ligne : guide de A a Z

Cible : **Firebase App Hosting** (le serveur Hono tourne dans Cloud Run, le CDN
est place devant). Compter environ 1 h la premiere fois.

Ordre imperatif : la base doit exister et etre initialisee **avant** d'envoyer
du trafic, et l'URI de redirection Google ne peut etre declaree qu'une fois le
domaine connu.

---

## Etape 0 : Prerequis

Outils en local :

```bash
node -v          # 20 ou plus
npm i -g firebase-tools
firebase login
```

Comptes a ouvrir (tous ont un mode d'essai) :

| Service | Pourquoi | Indispensable au lancement |
| --- | --- | --- |
| Google Cloud / Firebase | heberge le site | oui |
| Un MySQL managé | donnees boutique | oui |
| Stripe | encaisser les paiements | oui |
| Resend | emails de commande et SAV | fortement conseille |
| Sendcloud | etiquettes et points relais | non (mode demo sinon) |
| Google Cloud OAuth | connexion Gmail | non (le bouton se cache) |

Sans Sendcloud ni Google OAuth, la boutique fonctionne : methodes de livraison
de demonstration, et page de connexion sans bouton Google.

---

## Etape 1 : Creer le projet Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) > **Ajouter un projet**.
2. Activer la facturation (plan **Blaze**) : App Hosting l'exige.
3. Noter l'identifiant du projet, il servira partout ensuite.

---

## Etape 2 : La base MySQL

Deux chemins. Choisir **un seul**.

### Option A : MySQL managé externe (le plus simple)

Scaleway, OVH, Aiven, o2switch... N'importe quel MySQL 8 joignable en TCP avec
TLS. Recuperer une chaine de la forme :

```
mysql://utilisateur:motdepasse@hote:3306/dnmode?ssl={"rejectUnauthorized":true}
```

Rien d'autre a configurer : `apphosting.yaml` est deja pret.

### Option B : Cloud SQL for MySQL (tout dans GCP)

Coherent si tu veux une seule facture et un reseau prive.

1. Console GCP > **SQL** > Creer une instance > MySQL 8, edition Enterprise,
   machine a cœur partage, region **identique** a celle du backend App Hosting.
2. Creer la base `dnmode` et un utilisateur dedie.
3. Si tu utilises l'**IP privee**, decommenter le bloc `vpcAccess` dans
   `apphosting.yaml` :

```yaml
runConfig:
  vpcAccess:
    egress: PRIVATE_RANGES_ONLY
    networkInterfaces:
      - network: default
```

Attention : l'acces VPC n'existe **qu'a l'execution**, pas pendant le build.
Et pour lancer les commandes de l'etape 5 depuis ton poste, il faudra passer
par le **Cloud SQL Auth Proxy** :

```bash
cloud-sql-proxy PROJET:REGION:INSTANCE --port 3307
# puis DATABASE_URL=mysql://user:pass@127.0.0.1:3307/dnmode
```

> Detail utile : `api/queries/connection.ts` fixe `mode: "planetscale"`.
> C'est une option Drizzle sans rapport avec l'hebergeur, et elle est sans
> effet ici (le code n'utilise ni requetes relationnelles ni cles etrangeres).
> Avec un MySQL classique tu peux la passer a `"default"`.

---

## Etape 3 : Creer le backend App Hosting

Console Firebase > **App Hosting** > **Creer un backend** :

1. **Region** : `europe-west1` (ou celle de ta base).
2. **Depot GitHub** : `RamexDeltaXOO/dn-mode`, autoriser l'application Firebase.
3. **Branche de production** : `main`, deploiements automatiques **actives**.
4. **Racine** : `/`.

Firebase detecte `apphosting.yaml` et lance un premier deploiement, qui va
**echouer** faute de secrets. C'est normal, on les cree a l'etape suivante.

---

## Etape 4 : Les deux secrets obligatoires

Sans eux le conteneur refuse de demarrer (`api/lib/env.ts`).

```bash
# 1. Secret de signature des sessions : generer une valeur aleatoire longue
openssl rand -base64 48

firebase apphosting:secrets:set appSecret
# coller la valeur generee

# 2. Chaine de connexion MySQL de l'etape 2
firebase apphosting:secrets:set databaseUrl
```

La CLI propose d'accorder les permissions au backend : **accepter**. Si tu as
cree les secrets depuis la console Cloud Secret Manager a la place :

```bash
firebase apphosting:secrets:grantaccess appSecret
firebase apphosting:secrets:grantaccess databaseUrl
```

Les noms `appSecret` et `databaseUrl` sont ceux attendus par `apphosting.yaml` :
ne pas les renommer.

Relancer ensuite un deploiement (bouton **Deployer** dans la console, ou un
`git push` sur `main`). Le backend doit passer au vert et repondre sur son URL
`https://<backend>--<projet>.<region>.hosted.app`.

---

## Etape 5 : Initialiser la base

Depuis ton poste, en pointant sur la base de **production** :

```bash
git clone https://github.com/RamexDeltaXOO/dn-mode.git && cd dn-mode
npm ci

# .env local, uniquement pour ces commandes (ne jamais le commiter)
cat > .env <<'EOF'
DATABASE_URL=mysql://utilisateur:motdepasse@hote:3306/dnmode
APP_SECRET=peu-importe-ici
EOF

npm run db:push      # cree les tables
npm run db:seed      # collections, produits, 3 modes de livraison,
                     # gabarits d'emails, config par defaut (seuil 100€)

ADMIN_EMAIL=vous@dnmode.fr ADMIN_PASSWORD='un-mot-de-passe-long-et-unique' \
  npm run admin:create
```

`db:push` applique le schema sans fichier de migration : c'est la convention du
projet (le dossier `db/migrations/` est vide).

Le mot de passe admin doit faire **au moins 12 caracteres** ; il n'existe nulle
part dans le depot, uniquement dans cette commande.

Supprimer le `.env` ensuite : `rm .env`.

---

## Etape 6 : Renseigner les cles dans le CRM

Se connecter sur `https://<ton-url>/login` avec le compte admin, puis ouvrir
**Admin > Parametres**. Tout se saisit ici, rien a redeployer.

**Site web** : nom, email de contact, seuil de livraison offerte (100€ par
defaut, France metropolitaine).

**Page d'accueil** : image du bandeau principal et image « Look du moment ».
Envoyer un fichier (le stockage des images doit etre configure) ou coller une
URL. Sans choix, les images livrees avec le site s'affichent.

**Paiement Stripe** : cles depuis le tableau de bord Stripe. Commencer en mode
test (`pk_test_` / `sk_test_`), basculer en `pk_live_` / `sk_live_` une fois la
premiere commande validee. Cle vide = paiement simule.

**Livraison Sendcloud** : cle publique + cle secrete, puis **Tester la
connexion**. Ensuite **Admin > Livraison > Synchroniser depuis Sendcloud** pour
importer les methodes Colissimo / Chronopost / Mondial Relay.

**Emails transactionnels** : cle Resend, email expediteur, email SAV. Le domaine
d'envoi doit etre verifie chez Resend (enregistrements DNS SPF/DKIM), sinon les
emails partent en spam. Puis **Creer les templates par defaut**.

---

## Etape 7 : Connexion Gmail (optionnel)

1. Console GCP > **API et services** > **Identifiants** > Creer des
   identifiants > **ID client OAuth** > Application Web.
2. Dans **URI de redirection autorises**, coller **exactement** :

```
https://<ton-domaine>/api/auth/google/callback
```

Le CRM affiche cette URI avec un bouton **Copier** (Parametres > Connexion
Gmail) : l'utiliser plutot que la retaper.

3. Coller Client ID et Client Secret dans le CRM. Le bouton « Continuer avec
   Google » apparait alors sur la page de connexion.

Un compte Google dont l'email existe deja est **rattache** au compte existant,
pas duplique.

---

## Etape 8 : Domaine personnalise

Console Firebase > App Hosting > ton backend > **Domaines personnalises**,
ajouter `dnmode.fr`, puis creer les enregistrements DNS indiques chez ton
registrar. Le certificat TLS est emis automatiquement (compter jusqu'a 24 h).

Ensuite, deux choses a reprendre :

- l'URI de redirection Google (etape 7) avec le domaine definitif ;
- la variable `PUBLIC_APP_URL` dans `apphosting.yaml`, utilisee dans les liens
  des emails.

---

## Etape 9 : Verification avant ouverture

- [ ] La page d'accueil s'affiche, bandeau « Livraison offerte a partir de 100€ »
      qui defile sur mobile
- [ ] Un produit s'ouvre et s'ajoute au panier
- [ ] Sous 100€ les frais de port s'appliquent, au-dela « Offerte »
- [ ] Mondial Relay propose bien des points relais reels (pas « Mode demo »)
- [ ] Une commande test aboutit et l'email de confirmation arrive
- [ ] Admin > Commandes : la commande est la, « Creer l'etiquette Sendcloud »
      renvoie un numero de suivi
- [ ] Le formulaire de contact declenche l'accuse de reception, et une reponse
      depuis Admin > Messages arrive bien
- [ ] Connexion Gmail fonctionnelle (si configuree)

---

## Pieges connus

**`NODE_ENV=production` est vital.** `api/boot.ts` ne demarre le serveur HTTP
que si cette variable vaut `production`. C'est pourquoi `apphosting.yaml`
utilise `runCommand: npm run start` et non `node dist/boot.js`. Sans elle, le
conteneur demarre, n'ecoute sur rien, et le deploiement echoue au health check.

**Les deux secrets sont bloquants.** `DATABASE_URL` ou `APP_SECRET` manquant =
exception au demarrage, pas de message clair cote navigateur.

**`npm ci` doit joindre le registre npm public.** Le `package-lock.json`
d'origine pointait vers `npm.mirrors.msh.team`, un miroir prive inaccessible
depuis Cloud Build. Il a ete normalise vers `registry.npmjs.org` ; si tu
regeneres le lockfile depuis un environnement qui impose ce miroir, verifie
qu'aucune URL `msh.team` n'y revient.

**Changer `APP_SECRET` deconnecte tout le monde.** Les jetons de session sont
signes avec ; le modifier les invalide tous.

**Les emails partent en spam sans DNS.** Verifier le domaine chez Resend avant
la mise en ligne.

**Le seuil de livraison se change dans le CRM**, pas dans le code : Parametres >
Seuil livraison offerte. Il se propage au bandeau, au panier, a la fiche
produit, au tunnel et au calcul serveur.

---

## Deploiements suivants

Chaque `git push` sur `main` declenche un rollout. En cas de probleme, la
console App Hosting permet de revenir a une version precedente en un clic.

Si tu modifies `db/schema.ts`, relancer `npm run db:push` sur la base de
production, ce n'est pas automatique. Seule exception : les colonnes listees
dans `api/lib/ensure-schema.ts` (aujourd'hui `weight_grams` sur `products` et
`order_items`) sont ajoutees par le serveur lui-meme au demarrage s'il en
manque une. Ce mecanisme ne fait que des ajouts, jamais de suppression.

Les categories ont ete retirees du projet au profit des seules collections. La
table `categories` et la colonne `products.categoryId` restent en base sans
etre utilisees ; un prochain `db:push` proposera de les supprimer, ce qui est
sans risque.

## Points a traiter plus tard

- Les mots de passe sont haches en SHA-256 avec un sel statique partage. C'est
  faible face a une fuite de base ; passer a bcrypt ou Argon2 obligerait a
  reinitialiser les mots de passe existants.
- `db/migrations/` est vide : le projet fonctionne en `db:push`. Pour un
  historique de migrations versionne, passer a `npm run db:generate` puis
  `db:migrate`.
