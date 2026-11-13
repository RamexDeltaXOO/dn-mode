/** Textes juridiques par defaut. Toute modification depuis le CRM est conservee en base. */
export const LEGAL_DOCUMENT_TYPES = ["cgv", "cgu", "mentions-legales"] as const;
export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];
export type LegalDocumentDefinition = {
  title: string;
  path: string;
  configKey: string;
  description: string;
  defaultContent: string;
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentType, LegalDocumentDefinition> = {
  "cgv": {
    title: "Conditions générales de vente",
    path: "/cgv",
    configKey: "legal_cgv",
    description: "Prix, commande, livraison, rétractation, retours et garanties.",
    defaultContent: `Les présentes conditions générales de vente (CGV) régissent les commandes de produits effectuées par les consommateurs sur www.dn-mode.com auprès de DN MODE. Le client reconnaît avoir pris connaissance des CGV avant de passer commande. La version applicable est celle en vigueur lors de la commande ; toute modification ultérieure ne s'applique pas rétroactivement.

## 1. Produits et stocks disponibles

Les articles présentés sur www.dn-mode.com sont proposés dans la limite des stocks disponibles et tant que leur offre est visible. Les produits vendus sont neufs. DN MODE peut retirer un produit de la vente à tout moment, sans remettre en cause les commandes déjà acceptées. En cas d'indisponibilité après commande, le service client informera l'acheteur et lui proposera une solution conforme à ses droits.

## 2. Prix et frais de livraison

Les prix sont affichés en euros, toutes taxes applicables comprises. Toute modification du taux légal de TVA est répercutée conformément à la réglementation. Les frais de livraison, non inclus dans le prix des articles sauf indication contraire, sont présentés avant la validation de la commande. Plusieurs modes de livraison peuvent être proposés ; leurs tarifs et délais estimés sont indiqués pendant le parcours d'achat. Le paiement intégral est dû à la commande.

## 3. Validation des commandes et conclusion du contrat

Le client vérifie son panier, ses coordonnées, les frais et les modalités de livraison avant de confirmer sa commande. Un courriel récapitulatif est envoyé à l'adresse fournie après enregistrement de la commande. Si celle-ci ne peut être exécutée, DN MODE informe le client et applique les solutions prévues par la loi, y compris le remboursement le cas échéant.

## 4. Moyens de paiement

Les moyens de paiement disponibles sont affichés lors de la commande. Le paiement est traité par les prestataires sécurisés proposés sur le site. DN MODE ne demande jamais au client de communiquer par courriel ses codes confidentiels de carte bancaire.

## 5. Préparation, expédition et livraison

Les articles sont livrés à l'adresse indiquée lors de la commande. DN MODE s'efforce d'expédier les colis sous 24 à 48 heures ouvrées après confirmation de la commande, sous réserve de disponibilité et des contraintes logistiques. Ce délai de préparation est distinct du délai de livraison annoncé lors de la commande. Des événements imprévus (notamment grèves ou perturbations des transports) peuvent occasionner un retard ; les droits légaux du consommateur en cas de retard demeurent applicables.

Le client est invité à vérifier soigneusement les informations de livraison. En cas d'erreur imputable aux coordonnées transmises, des frais de réexpédition supplémentaires peuvent être proposés après information du client, sans priver celui-ci de ses droits légaux.

DN MODE demeure responsable de la bonne exécution de la livraison jusqu'à la prise de possession physique du bien par le client ou un tiers désigné par lui, sauf exception légale concernant un transporteur choisi indépendamment des options proposées par le vendeur. Un statut « livré en boîte aux lettres » ne prive pas le client de son droit de contester une livraison non reçue. En cas de colis manquant ou endommagé, contactez sav.dnmode@gmail.com.

## 6. Droit de rétractation et conditions de retour

Conformément au Code de la consommation, le consommateur dispose en principe de 14 jours à compter de la réception du bien (ou du dernier bien en cas de livraisons fractionnées) pour notifier sa décision de se rétracter, sans avoir à la justifier. Ce droit s'applique également aux articles en promotion ou soldés, sous réserve des exceptions légales.

La rétractation peut être exercée gratuitement depuis la page www.dn-mode.com/retractation, ou par une déclaration non équivoque adressée à sav.dnmode@gmail.com. Un modèle figure en fin de CGV. Le client renvoie ensuite le produit au plus tard 14 jours après avoir communiqué sa décision. L'adresse physique de retour doit être confirmée par le service client avant l'envoi.

Les frais directs de retour dans le cadre d'une rétractation sont à la charge du client, sauf prise en charge annoncée par DN MODE ou obligation légale contraire. Les produits peuvent être essayés dans la mesure nécessaire pour en apprécier la nature, les caractéristiques et le fonctionnement, comme en magasin. Une dépréciation liée à des manipulations allant au-delà de ce qui est nécessaire peut être retenue dans les conditions légales. Le client est invité à retourner l'article propre, non lavé, avec ses accessoires et, si possible, son emballage et ses étiquettes d'origine ; l'absence d'emballage d'origine ne supprime pas, à elle seule, le droit de rétractation.

DN MODE rembourse les sommes légalement dues, y compris les frais de livraison standard initiaux le cas échéant, dans les 14 jours suivant la notification de rétractation. Le remboursement peut être différé jusqu'à réception du produit retourné ou jusqu'à la fourniture d'une preuve d'expédition, selon la première de ces dates. Le même moyen de paiement est utilisé, sauf accord exprès du client pour un autre moyen sans frais supplémentaires.

Les exceptions prévues par la loi restent applicables, notamment pour certains articles nettement personnalisés ou certains biens descellés ne pouvant être renvoyés pour des raisons de protection de la santé ou d'hygiène. Une simple mise en promotion ne constitue pas une exception.

## 7. Échanges commerciaux

En dehors des garanties légales et du droit de rétractation, un échange de taille ou de modèle peut être proposé par le service client sous réserve de disponibilité. Les conditions d'un échange commercial éventuel sont communiquées au client avant tout retour. Cette faculté n'affecte pas les droits obligatoires au remboursement, à la mise en conformité ou à la rétractation.

## 8. Garanties légales et défauts

Le client bénéficie de la garantie légale de conformité prévue aux articles L.217-3 et suivants du Code de la consommation, notamment pendant deux ans à compter de la délivrance du bien, et de la garantie des vices cachés prévue aux articles 1641 et suivants du Code civil. Selon les conditions légales, le client peut demander la réparation ou le remplacement du produit, ou, dans les cas prévus, une réduction du prix ou la résolution de la vente.

DN MODE invite le client à signaler rapidement tout défaut apparent, idéalement sous 48 heures, avec des photographies, afin d'accélérer le traitement. Ce délai indicatif ne limite aucun droit ni délai de garantie légale. La qualité de distributeur de DN MODE ne supprime pas ses obligations légales de vendeur professionnel envers le consommateur.

## 9. Preuve des transactions

Les commandes, confirmations et paiements sont conservés sur des supports informatiques conformément à la réglementation applicable. Ils peuvent constituer des éléments de preuve, sous réserve des règles légales de preuve et des droits du consommateur.

## 10. Propriété intellectuelle

Les textes, visuels, photographies et éléments graphiques publiés sur www.dn-mode.com ou sur les réseaux sociaux officiels de DN MODE sont protégés par les droits de propriété intellectuelle de leurs titulaires. Toute réutilisation non autorisée est interdite dans les conditions prévues par la loi.

## 11. Données personnelles

Les données nécessaires au traitement des commandes, au service client et à la livraison sont traitées conformément à la réglementation sur la protection des données personnelles. Pour toute demande concernant vos données, écrivez à sav.dnmode@gmail.com.

## 12. Réclamations et médiation

Pour toute réclamation, contactez sav.dnmode@gmail.com ou utilisez le formulaire de contact du site. Après une réclamation écrite restée sans solution, le consommateur peut recourir gratuitement au médiateur de la consommation compétent.

Médiateur de la consommation : [À compléter dans le CRM : nom du médiateur effectivement désigné].
Adresse et site internet du médiateur : [À compléter dans le CRM : coordonnées et URL du médiateur].

## 13. Droit applicable

Les présentes CGV sont soumises au droit français, sous réserve des dispositions impératives protégeant le consommateur, notamment lorsque celui-ci réside dans un autre État.

## 14. Modèle de formulaire de rétractation

À l'attention de DN MODE — sav.dnmode@gmail.com — [À compléter dans le CRM : adresse postale du vendeur].

Je vous notifie par la présente ma rétractation du contrat portant sur le bien suivant :
Commande n° :
Commandé le / reçu le :
Nom du consommateur :
Adresse du consommateur :
Date :
Signature (uniquement en cas d'envoi papier) :`,
  },
  "cgu": {
    title: "Conditions générales d'utilisation",
    path: "/cgu",
    configKey: "legal_cgu",
    description: "Règles d'utilisation du site et des services DN MODE.",
    defaultContent: `Les présentes conditions générales d'utilisation (CGU) définissent les règles d'accès et d'utilisation du site www.dn-mode.com, édité sous la marque DN MODE. La consultation du site implique le respect des présentes conditions. Les achats sont régis séparément par les conditions générales de vente (CGV), accessibles depuis le pied de page du site.

## 1. Objet du site

DN MODE présente et commercialise des articles de mode en ligne. Les contenus du site sont destinés à informer les visiteurs sur les produits, les prix, les disponibilités et les services proposés.

## 2. Accès et fonctionnement

Le site est accessible sous réserve de la disponibilité d'Internet et des opérations nécessaires à sa sécurité, à sa maintenance et à son évolution. DN MODE s'efforce d'assurer un accès fiable, sans garantir une disponibilité ininterrompue. Les interruptions éventuelles ne privent pas les consommateurs de leurs droits légaux.

## 3. Comptes et sécurité

Lorsqu'un espace client est proposé, l'utilisateur s'engage à communiquer des informations exactes et à préserver la confidentialité de ses identifiants. En cas d'accès non autorisé suspecté, il est invité à contacter le service client. Les opérations abusives ou frauduleuses peuvent entraîner des mesures proportionnées de sécurisation, dans le respect des droits applicables.

## 4. Utilisation autorisée

L'utilisateur s'engage à ne pas compromettre la sécurité du site, contourner les contrôles d'accès, introduire des programmes malveillants, perturber le fonctionnement des services ou utiliser illicitement les données et contenus accessibles.

## 5. Informations et contenus

DN MODE s'efforce de présenter des informations exactes et actualisées. Les photographies et descriptions sont fournies à titre d'information et ne suppriment pas les obligations contractuelles du vendeur relatives aux caractéristiques annoncées des produits.

## 6. Commandes et paiements

Les conditions de prix, commande, paiement, livraison, retours, rétractation et garanties figurent dans les CGV. En cas de contradiction sur la vente d'un produit, les CGV applicables à la commande et les dispositions légales impératives prévalent.

## 7. Propriété intellectuelle

Les marques, logos, textes, photographies, créations et autres éléments du site sont protégés par la réglementation relative à la propriété intellectuelle. Toute reproduction ou réutilisation non autorisée est interdite, sauf exceptions légales.

## 8. Sites et services tiers

Des liens peuvent conduire à des sites ou services de partenaires ou de prestataires techniques. Leurs propres conditions peuvent s'appliquer. DN MODE ne contrôle pas le contenu des sites tiers indépendants et demeure responsable des obligations qui lui incombent au titre des services fournis aux clients.

## 9. Données personnelles

Les informations fournies via un formulaire, un compte client ou une commande peuvent être traitées pour les finalités nécessaires au fonctionnement du service et à l'exécution des commandes. Les demandes relatives aux droits sur les données personnelles peuvent être adressées à sav.dnmode@gmail.com. L'utilisation éventuelle de cookies ou traceurs est soumise à la réglementation applicable.

## 10. Évolution des CGU

DN MODE peut faire évoluer les présentes CGU. La version applicable à une utilisation donnée est celle publiée à cette date. Les modifications ne peuvent restreindre rétroactivement les droits acquis par les consommateurs.

## 11. Droit applicable et contact

Les présentes CGU sont soumises au droit français, sans préjudice des règles impératives applicables. Pour toute demande : sav.dnmode@gmail.com. Les coordonnées complètes de l'éditeur figurent dans la page « Mentions légales ».`,
  },
  "mentions-legales": {
    title: "Mentions légales",
    path: "/mentions-legales",
    configKey: "legal_mentions_legales",
    description: "Informations sur l'éditeur, l'hébergement et les droits.",
    defaultContent: `Cette page identifie l'éditeur et l'hébergeur du site www.dn-mode.com, conformément à la réglementation française. Les champs signalés « À compléter » doivent être renseignés par l'exploitant de la boutique depuis les paramètres du CRM.

## 1. Éditeur du site

Nom commercial : DN MODE.
Dénomination sociale ou nom et prénom de l'exploitant : [À compléter dans le CRM : identité juridique exacte].
Forme juridique : [À compléter dans le CRM : statut juridique].
Capital social, si société : [À compléter dans le CRM : montant en euros].
Adresse du siège ou de l'établissement : [À compléter dans le CRM : adresse postale complète].
Numéro SIREN / SIRET : [À compléter dans le CRM : immatriculation].
Immatriculation RCS / RNE et ville du greffe, selon le cas : [À compléter dans le CRM].
Numéro de TVA intracommunautaire, si applicable : [À compléter dans le CRM].
Adresse électronique : sav.dnmode@gmail.com.
Numéro de téléphone professionnel : [À compléter dans le CRM : numéro joignable].

## 2. Direction de la publication

Directeur ou directrice de la publication : [À compléter dans le CRM : nom et prénom].

## 3. Hébergement

Hébergeur technique du site : [À compléter dans le CRM : dénomination sociale de l'hébergeur].
Adresse postale de l'hébergeur : [À compléter dans le CRM : adresse complète].
Téléphone de l'hébergeur : [À compléter dans le CRM : numéro].

## 4. Propriété intellectuelle

La structure, les textes, les photographies, les illustrations, les marques et les signes distinctifs présents sur ce site sont protégés par les droits de leurs titulaires. Toute reproduction ou exploitation sans autorisation préalable est interdite, sauf exceptions prévues par la loi.

## 5. Données personnelles

Dans le cadre du fonctionnement de la boutique, des données peuvent être collectées notamment pour gérer les commandes, les livraisons, le service client, les comptes et les demandes envoyées via les formulaires. Les personnes concernées peuvent exercer leurs droits d'accès, de rectification, d'effacement et, dans les conditions prévues par le RGPD, d'opposition, de limitation et de portabilité en écrivant à sav.dnmode@gmail.com. Elles peuvent également saisir la CNIL en cas de difficulté.

Les informations complètes relatives aux finalités, bases légales, destinataires, durées de conservation et cookies doivent figurer dans la politique de confidentialité de DN MODE, à établir ou compléter selon les traitements réellement mis en œuvre.

## 6. Médiation de la consommation

Pour toute difficulté relative à un achat, le consommateur peut d'abord contacter sav.dnmode@gmail.com. Si le litige n'est pas résolu après une réclamation écrite, il peut saisir gratuitement le médiateur de la consommation compétent :
Nom du médiateur : [À compléter dans le CRM : organisme de médiation désigné].
Adresse et site internet : [À compléter dans le CRM : coordonnées et lien].

## 7. Droit applicable

Le site est soumis au droit français, sous réserve des dispositions impératives applicables aux consommateurs.`,
  },
};
