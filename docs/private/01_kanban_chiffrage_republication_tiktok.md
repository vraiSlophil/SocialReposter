# Kanban de production & chiffrage — Republication automatique TikTok → YouTube / Instagram / Facebook

Document interne prestataire. **Ne pas transmettre au client tel quel** (il contient les charges internes et la marge).
Le document destiné au client est le *Cahier des charges V1* (annexe au devis).

- TJM de référence : **400 € / jour**
- Unité d'estimation : le quart de journée (0,25 j = 2 h)
- Estimations en **charge nette de développement**, hors délais d'attente externes (validations de plateformes)

---

## 0. Décisions d'architecture retenues pour ce chiffrage

Ces décisions conditionnent tout le chiffrage. Si elles changent, le prix change.

| # | Décision | Justification |
|---|---|---|
| A1 | **TikTok reste le point d'entrée** (exigence client non négociable) | Contrainte UX fondamentale du client |
| A2 | Détection des nouvelles vidéos via l'**API officielle TikTok** (Display API, endpoint de liste de vidéos), avec repli sur interrogation du profil public | La Display API expose les métadonnées et l'identifiant de la vidéo — suffisant pour *détecter*, mais **elle ne fournit aucun lien de téléchargement du fichier** |
| A3 | Récupération du fichier vidéo par **méthode non officielle** (outil de type `yt-dlp` en primaire, service tiers payant en secours), derrière une **interface interchangeable** | Aucune API officielle TikTok ne permet aujourd'hui de récupérer le fichier d'une vidéo publiée depuis l'application. **C'est le risque n°1 du projet.** |
| A4 | Publication vers YouTube / Instagram / Facebook via une **passerelle de publication commerciale déjà agréée** (type Ayrshare, Upload-Post, Zernio, Blotato, ou Postiz Cloud), encapsulée derrière une abstraction maison | Voir §1 : évite 4 à 8 semaines de validation d'applications Meta/Google et le blocage « vidéos privées uniquement » de YouTube |
| A5 | **Postiz auto-hébergé écarté en V1** | Ne supprime pas les validations de plateformes (il faut quand même déclarer ses propres applications Meta / Google / TikTok), et impose PostgreSQL + Redis + Temporal + stockage objet → hébergement et maintenance nettement plus lourds. Licence AGPL-3.0 : à éviter si le socle doit devenir un produit revendu |
| A6 | Le socle logiciel reste la **propriété du prestataire**, le client reçoit une **licence d'utilisation non exclusive** | Objectif de réutilisation / produit |

### Pourquoi la passerelle de publication plutôt que les connecteurs natifs (point critique)

Vérifications effectuées sur l'état des API en 2026 :

- **YouTube Data API v3** : un projet créé après le 28/07/2020 qui n'a pas passé l'audit de conformité YouTube ne peut publier **qu'en visibilité « privée »**. Autrement dit, sans audit validé, les vidéos ne seront jamais publiques. L'audit n'a **aucun délai garanti**. Par ailleurs le quota par défaut est de 10 000 unités/jour et un envoi coûte 1 600 unités → environ 6 envois/jour maximum (non bloquant ici).
- **Instagram** : publication programmatique réservée aux comptes **professionnels (Business)** rattachés à une Page Facebook, avec les permissions `instagram_business_basic` et `instagram_business_content_publish` validées par **App Review Meta (2 à 6 semaines, plusieurs allers-retours fréquents)**, parfois précédée d'une vérification d'entreprise sur pièces justificatives. Plafond de 25 publications / 24 h par compte. L'API exige une **URL vidéo publiquement accessible** (d'où la tâche 3.4).
- **Facebook** : publication sur une **Page**, jamais sur un profil personnel, permissions Pages soumises à validation également.
- **TikTok** : l'application développeur doit passer un audit pour les scopes de production.

Conséquence : en connecteurs natifs, la charge de développement augmente de 6 à 8 jours **et** le projet devient tributaire de 4 à 8 semaines de délais administratifs non facturables et non maîtrisés. Sur un premier projet à forfait, c'est le scénario de perte. La passerelle commerciale ramène cela à un abonnement de 15 à 60 €/mois, refacturé dans l'abonnement d'exploitation.

Les connecteurs natifs sont donc proposés en **option d'évolution chiffrée**, pas en V1.

---

## 1. Kanban

Colonnes : `À faire` → `En cours` → `À valider (prestataire)` → `À valider (client)` → `Terminé`
Toutes les cartes démarrent en `À faire`. Les cartes marquées **OPTION** ne sont pas dans le forfait socle.

---

### LOT 0 — Validation technique en avant-vente · **1,50 j**
> **Réalisé AVANT l'envoi du devis, et non facturé en ligne distincte.** Sa charge est répartie sur les lots 2, 3 et 4, qui sont les modules qu'il valide.
>
> Raison : une ligne « étude de faisabilité » sur un devis vend une hypothèse et installe un doute. En testant d'abord, on vend une certitude. Le coût de ce lot devient un coût d'acquisition commerciale, récupéré dans le prix si l'affaire se signe, perdu si elle ne se signe pas — 1,5 j de risque d'avant-vente, ce qui est le standard du métier.
>
> **Conséquence : ne pas envoyer le devis avant d'avoir obtenu un résultat concluant sur les 10 vidéos réelles du client.**

| Carte | Description | Livrable | Charge |
|---|---|---|---|
| 0.1 | Prototype de détection des nouvelles publications TikTok (API officielle + repli profil public) | Script de démonstration | 0,50 j |
| 0.2 | Prototype de récupération automatique du fichier vidéo — 2 méthodes comparées sur **10 vidéos réelles du client** | Tableau comparatif : taux de succès, filigrane, résolution, bande son, latence | 0,50 j |
| 0.3 | Test de publication réelle sur YouTube et Instagram depuis des comptes de test | Captures + journaux | 0,25 j |
| 0.4 | Note de faisabilité, arbitrage d'architecture, gel du périmètre V1 | Note de 2 pages + périmètre validé | 0,25 j |

**Critère de décision** : au moins une méthode de récupération du média avec ≥ 9 succès sur 10, sans filigrane bloquant, en moins de 2 minutes.

- **Concluant** → envoyer le devis, la charge du lot étant répartie sur les lots 2, 3 et 4.
- **Non concluant** → ne pas envoyer ce devis. Proposer l'architecture alternative (dépôt du fichier par le client, publication vers les 4 plateformes y compris TikTok), qui fait l'objet d'un chiffrage distinct. 1,5 j perdus, aucun engagement contractuel pris à perte.

---

### LOT 1 — Fondations techniques · **1,25 j**

| Carte | Description | Charge |
|---|---|---|
| 1.1 | Spécification technique courte et modèle de données | 0,25 j |
| 1.2 | Initialisation du projet, conteneurisation, environnements de développement et de production | 0,25 j |
| 1.3 | Base de données et migrations : tables `videos`, `publications`, `tentatives`, `comptes` | 0,25 j |
| 1.4 | Gestion sécurisée des secrets et des jetons OAuth : chiffrement au repos, séparation du code source, absence de secret dans les journaux | 0,25 j |
| 1.5 | Journalisation structurée avec identifiant de corrélation par traitement | 0,25 j |

---

### LOT 2 — Détection des publications TikTok · **1,75 j**

| Carte | Description | Charge |
|---|---|---|
| 2.1 | Connecteur TikTok : authentification, autorisation du compte, lecture des publications | 0,50 j |
| 2.2 | Planificateur de surveillance : intervalle paramétrable, fenêtre de rattrapage, reprise après interruption | 0,25 j |
| 2.3 | Normalisation des métadonnées : identifiant, URL, description, hashtags, durée, date de publication, vignette | 0,25 j |
| 2.4 | Idempotence et anti-doublon : clé unique sur l'identifiant TikTok, verrou de concurrence, résistance au redémarrage du serveur | 0,25 j |
| 2.5 | **Filtrage des publications non vidéo** : TikTok autorise les diaporamas photo, qui doivent être détectés et ignorés sans faire échouer la chaîne de traitement | 0,25 j |
| 2.6 | **Règle d'exclusion volontaire** : un marqueur convenu dans la description TikTok (par exemple un mot-clé ou un émoji) empêche la republication d'une vidéo donnée, sans action supplémentaire du client | 0,25 j |

---

### LOT 3 — Récupération automatique du média · **1,75 j** ⚠️ *lot à risque*

| Carte | Description | Charge |
|---|---|---|
| 3.1 | Module de récupération média : interface interchangeable + 2 implémentations (outil local et service tiers) | 0,50 j |
| 3.2 | Basculement automatique entre méthodes, détection des cas d'échec (vidéo privée, supprimée, restreinte, protection anti-robot) | 0,25 j |
| 3.3 | Contrôle technique du fichier obtenu : durée, codec, format, ratio, poids, détection de filigrane | 0,25 j |
| 3.4 | Stockage temporaire et exposition d'une **URL publique signée à durée limitée** (exigence de l'API Meta, qui ne récupère la vidéo que depuis une URL accessible) | 0,50 j |
| 3.5 | Purge automatique des fichiers après publication (durée de conservation paramétrable) | 0,25 j |

---

### LOT 4 — Republication multi-plateformes · **1,75 j** (socle : YouTube + Instagram)

| Carte | Description | Charge |
|---|---|---|
| 4.1 | Couche d'abstraction de publication : destinations enfichables et remplaçables sans réécriture | 0,25 j |
| 4.2 | Adaptateur de la passerelle de publication : envoi, suivi de statut asynchrone, interprétation des codes d'erreur | 0,50 j |
| 4.3 | Destination **YouTube** : titre dérivé de la description, description, tags issus des hashtags, visibilité, traitement du format Shorts | 0,50 j |
| 4.4 | Destination **Instagram Reels** : légende (limite 2 200 caractères), vignette, partage au fil | 0,50 j |
| 4.5 | **OPTION** — Destination **Facebook** (Page, format Reel ou vidéo) | 0,50 j |
| 4.6 | **OPTION** — Adaptation automatique des descriptions par plateforme (règles de réécriture, nettoyage et remappage des hashtags, mentions) | 0,50 j |

---

### LOT 5 — Fiabilité, reprise sur erreur et alertes · **1,00 j**

| Carte | Description | Charge |
|---|---|---|
| 5.1 | File de traitements et machine à états : `détectée` → `média récupéré` → `publication en cours` → `publiée` / `en échec` | 0,50 j |
| 5.2 | Nouvelles tentatives automatiques avec temporisation croissante, plafond de tentatives, distinction erreur temporaire / définitive | 0,25 j |
| 5.3 | Alertes par email : échec définitif, jeton expiré, quota atteint, format refusé | 0,25 j |

---

### LOT 6 — Outils d'exploitation, sans interface web · **0,25 j**

| Carte | Description | Charge |
|---|---|---|
| 6.1 | Commandes en ligne de commande côté serveur : relancer une publication, ignorer une vidéo, publier une URL TikTok à la demande, afficher les 20 derniers traitements | 0,25 j |

**Décision** : pas d'interface web, pas d'authentification à développer, pas de page de connexion. Le client n'interagit pas avec le système, et le prestataire dispose déjà d'un accès serveur. L'interface web devient une évolution facturable si le besoin apparaît (§6 bis).

---

### LOT 7 — Hébergement et mise en production · **0,75 j**

| Carte | Description | Charge |
|---|---|---|
| 7.1 | Provisionnement du serveur et durcissement : accès distant, pare-feu, mises à jour automatiques de sécurité | 0,25 j |
| 7.2 | Déploiement, nom de domaine technique, certificat TLS, reverse proxy | 0,25 j |
| 7.3 | Sauvegardes automatiques quotidiennes (base et configuration) et **test de restauration effectif** | 0,25 j |

---

### LOT 8 — Recette, documentation et transfert · **1,25 j**

| Carte | Description | Charge |
|---|---|---|
| 8.1 | Tests automatisés sur les points critiques : idempotence, reprises, correspondances de métadonnées | 0,25 j |
| 8.2 | Recette de bout en bout sur vidéos réelles et **procès-verbal de recette** signé | 0,50 j |
| 8.3 | Documentation d'exploitation (prestataire) et guide client d'une page | 0,25 j |
| 8.4 | Session de prise en main d'une heure et démarrage de la garantie | 0,25 j |

---

### LOT 9 — Réserve pour aléas techniques · **2,00 j**
Consacrée aux ruptures de dépendances externes pendant le développement (évolution TikTok, changement de format d'API, refus de format vidéo). Non consommée = marge conservée. **Ne pas retirer : c'est l'assurance du forfait.**

---

## 2. Synthèse de charge

| Lot | Socle (j) | Options (j) |
|---|---|---|
| LOT 0 — Validation technique (avant-vente, charge répartie) | 1,50 | — |
| LOT 1 — Fondations | 1,25 | — |
| LOT 2 — Détection TikTok | 1,75 | — |
| LOT 3 — Récupération média | 1,75 | — |
| LOT 4 — Republication (YouTube + Instagram) | 1,75 | 1,00 |
| LOT 5 — Fiabilité et alertes | 1,00 | — |
| LOT 6 — Outils d'exploitation | 0,25 | 1,00 |
| LOT 7 — Hébergement et mise en production | 0,75 | — |
| LOT 8 — Recette et transfert | 1,25 | — |
| LOT 9 — Réserve aléas | 2,00 | — |
| **Total** | **13,25 j** | **3,00 j** |

- Charge socle : **13,25 j** → **5 300 €** au TJM de 400 €
- Évolutions hors devis : 3,00 j → 1 200 €
- Option lourde hors tableau : **connecteurs natifs Meta / Google / TikTok** (suppression de la passerelle commerciale) → **+7,00 j → 2 800 €**, plus 4 à 8 semaines de délai administratif non maîtrisé

### Effet de l'assistance IA sur le développement
Gain de productivité attendu de 20 à 40 % sur les lots 1, 4, 6 et 8 essentiellement (code répétitif, mappings, interface d'administration, tests). Ce gain **n'est pas répercuté** dans le prix : il constitue la marge de sécurité qui rend le forfait tenable. Les lots 0, 2, 3 et 9 — c'est-à-dire la partie réellement risquée — n'en bénéficient quasiment pas.

---

## 3. Lignes destinées au devis

### Bloc A — Prestation initiale

Six lignes en langage client. Le détail technique reste interne : le client achète un résultat, pas une liste de modules.

| # | Libellé de la ligne de devis | Détail | Qté | P.U. | Total |
|---|---|---|---|---|---|
| A1 | **Socle technique et détection des publications TikTok** | Surveillance du compte, détection des nouvelles vidéos, garantie qu'une vidéo n'est traitée qu'une seule fois, exclusion des diaporamas photo, règle d'exclusion volontaire par marqueur | 3,5 j | 400 € | 1 400 € |
| A2 | **Récupération automatique des vidéos** | Deux méthodes de récupération avec basculement automatique, contrôle de la qualité du fichier, stockage temporaire et suppression après publication | 2,5 j | 400 € | 1 000 € |
| A3 | **Republication automatique sur YouTube et Instagram** | Reprise du titre, de la description et des hashtags, adaptation aux contraintes de chaque plateforme, envoi et vérification | 2,0 j | 400 € | 800 € |
| A4 | **Fiabilité, reprises automatiques et alertes** | Nouvelles tentatives automatiques en cas d'incident, alerte par email si une publication échoue définitivement, outils de relance manuelle | 1,25 j | 400 € | 500 € |
| A5 | **Mise en service, tests et prise en main** | Installation sur serveur, sauvegardes quotidiennes, tests sur vidéos réelles, procès-verbal de recette, session de prise en main | 2,0 j | 400 € | 800 € |
| A6 | **Provision pour évolutions des plateformes** | Adaptation aux changements de TikTok, YouTube et Instagram pendant la phase de réalisation | 2,0 j | 400 € | 800 € |
| | **TOTAL PRESTATION INITIALE** | | **13,25 j** | | **5 300 €** |

Correspondance interne entre lignes de devis et lots :

| Ligne | Lots couverts |
|---|---|
| A1 | LOT 1 + LOT 2 + 0,5 j du LOT 0 |
| A2 | LOT 3 + 0,75 j du LOT 0 |
| A3 | LOT 4 + 0,25 j du LOT 0 |
| A4 | LOT 5 + LOT 6 |
| A5 | LOT 7 + LOT 8 |
| A6 | LOT 9 |

La charge du LOT 0, réalisée en avant-vente, est répartie sur les trois lignes qu'elle valide. Le total facturé reste identique ; seule la présentation change. Aucune ligne « étude de faisabilité » n'apparaît sur le devis.

### Bloc B — Abonnement d'exploitation (obligatoire, sans lui le service ne fonctionne pas)

| # | Libellé | Périodicité | P.U. |
|---|---|---|---|
| B1 | **Formule Exploitation & Maintenance — engagement 12 mois** : hébergement dédié, supervision 7 j/7, abonnement à la passerelle de publication (dimensionné pour 90 publications par mois), sauvegardes quotidiennes, surveillance et renouvellement des jetons d'accès, mises à jour de sécurité, adaptation aux évolutions des plateformes, maintenance corrective dans la limite de 1 h/mois, alertes | mensuel | **189 €** |
| B2 | *Variante sans engagement de durée* | mensuel | 219 € |
| B3 | *Variante avec paiement annuel d'avance (2 mois offerts)* | annuel | 1 890 € |
| B4 | Intervention hors forfait de maintenance (évolution, incident imputable à un tiers, demande nouvelle) | à l'heure | 60 € |

### Bloc C — Conditions financières

| Élément | Valeur |
|---|---|
| Acompte à la commande | **40 %**, soit **2 120 €** |
| Solde | à la signature du procès-verbal de recette |
| Abonnement d'exploitation | premier mois payable à la mise en production |
| Validité du devis | 30 jours |
| Délai indicatif de réalisation | **5 à 7 semaines** à compter de la réception de l'acompte et des accès (dont 2 semaines liées aux dépendances externes) |
| Garantie corrective | 60 jours après recette, sur le périmètre recetté |
| **Clause de sortie après la phase 1** | Si la note de faisabilité conclut à l'impossibilité de récupérer automatiquement le fichier vidéo depuis TikTok de manière fiable, le client peut mettre fin au contrat sans indemnité. Seule la phase 1 (600 €) reste due, le solde de l'acompte est remboursé sous 15 jours, et une proposition alternative est remise. |
| Pénalités de retard | intérêts au taux légal + indemnité forfaitaire de 40 € |

> **Régime fiscal** — Si le prestataire relève de la franchise en base de TVA, remplacer partout « € » par « € » et faire figurer la mention **« TVA non applicable, article 293 B du CGI »**. Ne pas écrire « HT » sans facturer de TVA : c'est une irrégularité que le client peut relever.

---

## 4. Variantes de prix et zone d'atterrissage

| Scénario | Charge | Prix | Commentaire |
|---|---|---|---|
| **Socle V1 (retenu)** | 13,25 j | **5 300 €** | **Recommandé.** Sans interface web, provision pour aléas portée à 2 j |
| Provision pour aléas à 1,5 j | 12,75 j | 5 100 € | Marge de sécurité de 14 %, jugée insuffisante au vu de la dépendance non officielle à TikTok |
| Avec interface web d'administration | 14,25 j | 5 700 € | Écarté : complexité et marge dégradée pour un besoin non exprimé |
| Sans provision pour aléas | 11,25 j | 4 500 € | Déconseillé : la première rupture TikTok se règle sur votre temps |
| Cible initialement envisagée | ~8,75 j | 3 500 € | Non tenable au périmètre décrit |

**Retour sur investissement pour le client** : 6 republications manuelles par jour évitées, soit environ 10 heures par mois.

### Où placer la marge de sécurité (et où ne pas la placer)

Le réflexe est de majorer chaque estimation de 10 à 15 %. C'est une mauvaise idée sur un devis détaillé : un client qui compare trois propositions regarde les lignes une par une, et « 0,75 j pour connecter Instagram » se discute plus facilement que « 1,5 j de provision pour dépendances tierces ». Une majoration diffuse est indéfendable ligne à ligne ; une réserve unique, nommée et justifiée, se défend sur le fond — d'autant que le fond est solide ici.

La marge de sécurité est donc concentrée sur la **ligne A6**, portée à 2,00 j. Les estimations des autres lots restent celles que vous pourrez défendre tâche par tâche sans rougir.

Effet net : **13,25 j au lieu de 11,25 j de charge productive, soit +17,8 % de marge de sécurité**. C'est le bon niveau pour un premier projet au forfait dont le composant central repose sur une méthode non officielle. Si le développement se déroule sans incident, cette provision reste acquise ; c'est là que se situe votre rentabilité réelle sur cette mission, pas dans le TJM affiché.

### Pourquoi la fourchette 3 000 – 4 000 € initialement envisagée est un piège
Elle correspond à 7,5 – 10 jours. Or les lots réellement incontournables pour tenir la promesse « je poste sur TikTok, le reste se fait tout seul » — détection, récupération du média, idempotence, reprises sur erreur, mise en production, recette — pèsent déjà 8,25 j **sans** interface d'administration, **sans** réserve et **sans** faisabilité. Vendre 3 500 € revient à financer sur ses propres nuits chaque évolution de TikTok pendant douze mois. Le bon positionnement face aux devis concurrents n'est pas le prix : c'est le fait d'être le seul à avoir écrit noir sur blanc le problème du filigrane, celui de la musique sous licence et celui de l'audit YouTube.

---

## 4 bis. Hypothèses de volume et conséquences

Volume communiqué par le client : **2 à 3 vidéos par jour**, soit 60 à 90 publications TikTok par mois, et 120 à 180 republications mensuelles sur deux destinations.

| Contrainte | Plafond de la plateforme | Consommation attendue | Marge |
|---|---|---|---|
| YouTube — quota journalier | 10 000 unités/jour, 1 600 unités par envoi, soit 6 envois/jour | 3 envois/jour = 4 800 unités | Suffisante, mais **une seule vidéo supplémentaire par jour rapprocherait du plafond**. Au-delà de 5 vidéos/jour, une demande d'extension de quota devient nécessaire (procédure Google sans délai garanti) |
| Instagram — publications par 24 h | 25 | 3 | Large |
| Instagram — appels par heure | 200 par compte | Une dizaine | Large |
| Récupération du média | Aucun plafond officiel, mais protections anti-robot | 90 récupérations/mois | Volume modeste, risque de blocage faible mais non nul |
| Transfert et stockage temporaire | — | 90 fichiers/mois, environ 5 Go de transfert | Négligeable |

**Conséquences sur le chiffrage :**

1. Le volume rend indispensables deux fonctions que je n'avais pas prévues et qui sont désormais dans le socle : le **filtrage des diaporamas photo** (à 3 publications/jour, la probabilité qu'un post non vidéo passe dans la chaîne est élevée) et la **règle d'exclusion volontaire** (à ce rythme, une partie des contenus relève de l'expérimentation et n'a pas vocation à alimenter la chaîne YouTube). Sans ces deux fonctions, l'automatisation devient un problème plutôt qu'une solution. Coût : +0,5 j.
2. Le coût réel de la passerelle de publication augmente avec le volume. Les offres d'entrée de gamme sont souvent plafonnées ; à 180 publications mensuelles il faudra vérifier le palier tarifaire exact avant de s'engager. J'ai relevé l'hypothèse de coût mensuel de 45 à 75 €, ce qui justifie de porter l'abonnement d'exploitation à **189 €/mois**. Marge de trésorerie mensuelle : 114 €, soit 54 € nets si l'heure de maintenance incluse est consommée.
3. **L'argument de valeur devient très fort.** À 3 vidéos par jour et 2 plateformes, le client effectue aujourd'hui 6 republications manuelles quotidiennes, soit de l'ordre de 10 heures par mois. C'est le chiffre à mettre en face du prix, bien plus que le nombre de jours de développement.

---

## 5. Registre des risques

| Risque | Probabilité | Impact | Traitement |
|---|---|---|---|
| Aucune méthode fiable de récupération du fichier TikTok | Moyenne | **Critique** | LOT 0 avant engagement au forfait ; clause de bascule vers l'architecture alternative |
| Rupture de la méthode de récupération en cours d'exploitation | **Élevée** (sur 12 mois) | Élevé | Deux méthodes avec basculement, abonnement de maintenance, clause d'obligation de moyens |
| Filigrane TikTok présent sur la vidéé récupérée | Moyenne | Moyen | Mesuré en LOT 0 ; à valider explicitement par le client avant développement |
| Réclamation de droits d'auteur sur la musique | **Faible** — le client a confirmé ne pas utiliser de musique | Élevé si le cas survenait | Transformé en **déclaration du client** au cahier des charges §9.3 : si un son sous licence TikTok était utilisé ultérieurement, la responsabilité lui incombe |
| Publication d'un diaporama photo TikTok bloquant la chaîne | **Élevée** à 3 publications/jour | Moyen | Carte 2.5, filtrage explicite |
| Republication de contenus expérimentaux non souhaités sur YouTube | **Élevée** à 3 publications/jour | Moyen | Carte 2.6, règle d'exclusion par marqueur |
| Dépassement du quota YouTube si le rythme augmente | Moyenne | Moyen | Surveillance du quota, alerte, demande d'extension anticipée si le rythme dépasse 5 vidéos/jour |
| Vidéos publiques uniquement en « privé » sur YouTube (audit de conformité non obtenu) | Élevée en connecteurs natifs, **nulle** avec la passerelle | Critique | Justifie à lui seul le choix A4 |
| Refus ou lenteur de la validation d'application Meta | Élevée en connecteurs natifs, **nulle** avec la passerelle | Critique | Idem |
| Suspension du compte TikTok pour automatisation | Faible | Élevé | Aucune action d'écriture sur TikTok, aucun partage d'identifiants, respect des conditions d'utilisation |
| Le client attend une obligation de résultat sur des services qu'il ne contrôle pas | Élevée | Moyen | Cahier des charges §9 et §10, à faire valider **avant** signature |
| Élargissement du périmètre en cours de route | Élevée | Moyen | Périmètre gelé en LOT 0, options chiffrées au bloc B |

---

## 6. Questions à poser au client avant d'émettre le devis

**Bloquantes** (le devis ne peut pas être émis sans réponse)
1. Facebook fait-il partie de la V1 ? Si oui, s'agit-il d'une Page Facebook et disposez-vous des droits d'administration ?
2. ~~Compte Instagram professionnel ?~~ → Posé comme **prérequis** au cahier des charges §7.2, pas comme une question. Si le compte est personnel, le client le signalera de lui-même.
3. ~~Musique dans les vidéos ?~~ → **Résolu : pas de musique.** Transformé en déclaration du client au cahier des charges §9.
4. Acceptez-vous que les vidéos republiées puissent porter le **filigrane TikTok**, si la récupération sans filigrane s'avère non fiable ?
5. ~~Type de compte TikTok ?~~ → **Résolu : compte Business.** L'accès à l'interface officielle TikTok est donc possible. Reste à confirmer l'existence d'une chaîne YouTube active.

**Structurantes** (impactent le prix ou le périmètre)
6. ~~Volume ?~~ → **Résolu : 2 à 3 vidéos par jour.** Non mentionné au cahier des charges, où seules les limites brutes figurent.
7. Quel délai maximal acceptez-vous entre la publication TikTok et les republications ? (15 min, 1 h, 4 h — plus le délai est court, plus la surveillance est coûteuse.)
8. Pour YouTube : Shorts uniquement, ou également des vidéos longues au-delà d'un certain seuil ?
9. Le titre YouTube doit-il être dérivé automatiquement de la description TikTok, ou suivre une règle particulière ?
10. Les hashtags TikTok doivent-ils être conservés tels quels sur les autres plateformes ?
11. Qui reçoit les alertes en cas d'échec : le client, le prestataire, ou les deux ?
11 bis. Un autre outil de republication automatique est-il déjà actif sur ces comptes ? → Posé comme prérequis au cahier des charges §7.6 plutôt que comme une question ouverte.
12. Combien de temps faut-il conserver les fichiers vidéo après publication ?
13. ~~Accès à l'interface d'administration ?~~ → **Résolu : aucune interface web développée.**

**Commerciales**
14. Quel budget avez-vous prévu pour cette automatisation ?
15. Souhaitez-vous acquérir la propriété du code source, ou une licence d'utilisation suffit-elle ? (La cession exclusive fait l'objet d'un devis distinct, d'un montant sensiblement supérieur.)
16. Préférez-vous un engagement de 12 mois sur l'exploitation, ou une formule mensuelle sans engagement ?
17. Le serveur doit-il être souscrit à votre nom, ou inclus dans l'abonnement d'exploitation ?

---

## 6 bis. Évolutions volontairement absentes du devis

Ces éléments sont chiffrés mais **ne figurent pas sur le devis**, conformément à la stratégie retenue : proposer le périmètre minimum viable, puis présenter les évolutions lors des points de suivi, une fois la confiance établie et le service en fonctionnement.

| Évolution | Charge | Prix indicatif | Moment opportun pour la proposer |
|---|---|---|---|
| Destination Facebook (Page, Reel) | 0,50 j | 200 € | Dès que la V1 tourne sans incident, si le client mentionne Facebook |
| Adaptation automatique des descriptions par plateforme | 0,50 j | 200 € | Quand le client constatera que le même texte ne performe pas partout |
| Reconnexion des comptes en autonomie | 0,25 j | 100 € | Après le premier incident de jeton expiré, où il aura ressenti la dépendance |
| Interface web d'administration (accès protégé, tableau de statuts, relance en un clic) | 1,00 j | 400 € | Quand il demandera à voir lui-même ce qui est parti |
| Historique, filtres et indicateurs de publication | 0,75 j | 300 € | Quand il commencera à demander « combien de vidéos sont parties le mois dernier ? » |
| Connecteurs natifs Meta / Google / TikTok | 7,00 j | 2 800 € | Uniquement si la passerelle devient un problème de coût ou de fiabilité |
| Reprise de l'historique des anciennes vidéos | 0,50 j | 200 € | Peut se présenter très tôt : à garder en réserve pour une concession de négociation |

**Levier de négociation** : si le client demande une baisse de prix, ne pas baisser le prix. Retirer du périmètre, ou concéder une évolution à venir gratuitement plus tard. Une remise consentie sur le premier devis fixe votre tarif de référence pour toute la relation.

---

## 7. Séquencement retenu

```
Semaine -1   VALIDATION TECHNIQUE EN AVANT-VENTE (LOT 0, non facturé en ligne distincte)
             ├── Concluant     → envoi du devis
             └── Non concluant → pas de devis, proposition alternative distincte
Semaine 0    Note de cadrage + devis unique (5 300 €) + 3 annexes
Semaine 1    Acompte 40 % (2 120 €) → LOT 1, LOT 2
Semaines 2-3 LOT 3, LOT 4
Semaine 4    LOT 5, LOT 6
Semaine 5    LOT 7, LOT 8 — recette, procès-verbal, mise en service
Semaine 5+   Abonnement d'exploitation et garantie de 60 jours
```

**Le principe à retenir : ne jamais signer un forfait sur une hypothèse technique non vérifiée.** La différence avec la version précédente n'est pas le niveau de prudence, c'est qui en supporte le coût — ici le prestataire, en avant-vente, ce qui est commercialement plus fort et supprime toute discussion.

