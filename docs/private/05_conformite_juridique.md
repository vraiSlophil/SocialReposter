# Conformité juridique — Prestataire indépendant en développement logiciel

Document de travail interne. État du droit au 8 août 2026.

> **Avertissement.** Ce document est une synthèse documentaire, pas un avis juridique. Il n'est pas rédigé par un avocat. Les points marqués ⚠️ méritent une validation professionnelle avant d'être opposés à un client.
>
> **Sur le recours à un avocat.** Faire relire l'intégralité d'un jeu de contrats coûte de l'ordre de 1 000 à 2 000 € : c'est disproportionné sur un premier projet à 5 300 €. Le risque n'est cependant pas uniforme. Deux clauses seulement peuvent coûter cher si elles sont mal rédigées : le **plafond de responsabilité** (article 11 des conditions générales) et la **propriété intellectuelle** (article 10). Une consultation ciblée d'une heure sur ces deux points, de l'ordre de 150 à 250 €, constitue le bon compromis — à financer après deux ou trois missions, pas avant la première. Vérifier au préalable si l'assurance de responsabilité civile professionnelle inclut une assistance juridique : c'est fréquent, et gratuit.

---

## PARTIE A — Obligations liées au statut

### A1. Facturation électronique — échéance imminente ⚠️

**1er septembre 2026 : obligation de pouvoir RECEVOIR des factures électroniques.** Cette obligation s'applique à toutes les entreprises établies en France, y compris les micro-entreprises et y compris celles en franchise de TVA. Environ 10 millions d'entreprises sont concernées.

Concrètement : il faut avoir **désigné une Plateforme Agréée (PA)** par la DGFiP avant cette date. Un PDF reçu par email ne constitue plus une facture électronique conforme. Les fournisseurs tenus d'émettre au format structuré (grandes entreprises et ETI dès le 1er septembre 2026) transmettront exclusivement par ce canal — hébergeur, opérateur télécom, éditeurs de logiciels, assurances.

**1er septembre 2027 : obligation d'ÉMETTRE** au format structuré (Factur-X, UBL ou CII, norme EN 16931) et de faire de l'e-reporting. Les micro-entreprises sont dans cette seconde vague.

Les sanctions ont été revalorisées par la loi de finances pour 2026, avec une sanction dédiée à l'absence de plateforme désignée.

**Action : choisir et déclarer une Plateforme Agréée avant le 1er septembre 2026.** C'est l'action la plus urgente de tout ce document.

### A2. Changement de la mention TVA au 1er septembre 2026

L'ordonnance n° 2025-1247 du 17 décembre 2025 a recodifié les dispositions TVA au sein du Code des impositions sur les biens et services. À compter du 1er septembre 2026, la mention devient :

> **« TVA non applicable, art. L. 223-3 du CIBS »**

Une tolérance est admise jusqu'au 31 décembre 2027 pour l'ancienne et la nouvelle formulation. La mention actuelle « art. 293 B du CGI » reste donc valable, mais les modèles de devis et de factures doivent être mis à jour d'ici fin 2027.

### A3. Mentions obligatoires — corrections à apporter au modèle actuel

Points relevés sur le devis existant :

| Problème | Correction |
|---|---|
| « Prix unitaire HT », « Total HT » alors que la TVA n'est pas applicable | Remplacer par « Prix unitaire » et « Total », ou « net de taxe ». Écrire « HT » laisse entendre qu'une TVA s'ajoutera |
| Mention « EI » ou « Entrepreneur individuel » absente | Obligatoire dans la dénomination depuis la loi du 14 février 2022 : **« Nathan OUDER EI »** sur tous les documents commerciaux |
| Champ « Société : Nathan OUDER » | Une entreprise individuelle n'est pas une société. Remplacer par « Prestataire » ou « Entrepreneur individuel » |
| « Numéro d'entreprise » | Terminologie inhabituelle en droit français. Utiliser « SIRET » |
| Coquille « ntérêts de retard : ntérêts de retard » | À corriger |

Rappel des sanctions : **15 € par mention manquante ou inexacte**, plafonnée à 25 % du montant de la facture, avec des plafonds globaux très élevés en cas de manquement systématique. La numérotation doit être chronologique et continue, sans saut ni doublon.

Nouvelles mentions à anticiper pour la vague d'émission : SIREN du client, nature de l'opération (livraison de biens, prestation de services, ou les deux), adresse de livraison si différente.

### A4. Seuils de TVA — état confirmé pour 2026

La loi n° 2025-1044 du 3 novembre 2025 a abrogé le projet de seuil unique à 25 000 €, et l'article du projet de loi de finances 2026 qui prévoyait 37 500 € pour tous a été supprimé par le Parlement. Les seuils restent donc inchangés :

| Activité | Seuil de base | Seuil majoré |
|---|---|---|
| **Prestations de services** | **37 500 €** | **41 250 €** |
| Ventes et hébergement | 85 000 € | 93 500 € |

Deux points de vigilance :

- **La règle des deux dépassements successifs a été supprimée** par la loi de finances pour 2025. Un seul dépassement du seuil de base entraîne la sortie de la franchise au 1er janvier de l'année suivante.
- Le franchissement du **seuil majoré** rend redevable de la TVA **immédiatement, dès le jour du dépassement**.

Conséquence directe : ce projet représente environ 7 500 € la première année. Trois à quatre clients de ce type suffisent à approcher 37 500 €. Il faut suivre le cumul mensuellement et anticiper le passage à la TVA — qui n'est pas une catastrophe, mais qui change la présentation des prix et impose des déclarations.

### A5. Obligations comptables et administratives courantes

- Livre des recettes tenu chronologiquement, avec date d'encaissement, numéro de facture, identité du client, nature de la prestation, montant et mode de règlement.
- Déclaration du chiffre d'affaires selon la périodicité choisie, y compris en cas de chiffre d'affaires nul.
- Compte bancaire dédié à l'activité au-delà de 10 000 € de chiffre d'affaires deux années consécutives.
- Factures rédigées en français, conservées dix ans.
- Facture obligatoire pour toute transaction avec un professionnel, et dès 25 € avec un particulier.

### A6. Assurance de responsabilité civile professionnelle

Le développement logiciel n'est **pas une profession réglementée** : la RC pro n'est donc pas légalement obligatoire. Elle reste vivement conseillée, pour deux raisons propres à cette activité.

D'abord parce que les sinistres y sont presque toujours **immatériels** : bug en production, indisponibilité, perte de données, retard bloquant. Or de nombreux contrats excluent les **préjudices immatériels non consécutifs** sans option spécifique. C'est précisément le risque à couvrir ici — il faut vérifier ce point ligne par ligne dans les conditions particulières.

Ensuite parce que la prestation ne se limite pas au développement : elle inclut **hébergement, supervision et maintenance**. Ces activités doivent être **déclarées à l'assureur**. Une activité non déclarée entraîne la déchéance de garantie au moment du sinistre, c'est-à-dire exactement quand l'assurance servirait.

Ordre de grandeur pour un développeur : 200 à 500 € par an, cotisation déductible. Plafond de garantie recommandé au moins égal au chiffre d'affaires annuel.

---

## PARTIE B — Obligations contractuelles et précontractuelles

### B1. Droit de rétractation du petit professionnel — le point le plus sous-estimé ⚠️

L'article **L. 221-3 du Code de la consommation** étend certaines protections consuméristes aux contrats conclus **hors établissement** entre deux professionnels, sous **trois conditions cumulatives** :

1. le contrat est conclu **hors établissement** ;
2. son objet **n'entre pas dans le champ de l'activité principale** du professionnel sollicité ;
3. celui-ci emploie **cinq salariés ou moins**.

Appliqué à cette mission :

| Condition | Situation |
|---|---|
| Objet hors activité principale | **Probablement remplie.** La jurisprudence a jugé qu'un site internet n'entrait pas dans le champ de l'activité d'un architecte. Un outil d'automatisation de réseaux sociaux n'entre vraisemblablement pas dans celui d'un conseiller en gestion de patrimoine |
| Cinq salariés ou moins | **Probablement remplie** |
| Hors établissement | **Le point déterminant.** Un contrat signé lors d'un rendez-vous chez le client, ou à la suite d'un démarchage, est conclu hors établissement. Un contrat conclu entièrement à distance relève en principe du régime des contrats à distance, que la lettre de l'article L. 221-3 ne visait pas |

Conséquences si l'article s'applique :

- **droit de rétractation de quatorze jours** sans motif, à compter de la conclusion du contrat ;
- ce texte est **d'ordre public** : aucune clause contraire ne peut y déroger ;
- **à défaut d'information du client sur ce droit, le délai est prolongé de douze mois** ;
- l'article L. 221-10 limite la possibilité d'exiger un **paiement avant sept jours** à compter de la conclusion, ce qui heurte de front l'acompte exigible à la commande.

**Recommandation pratique**, la moins coûteuse et la plus sûre : traiter la question comme si l'article s'appliquait. C'est l'objet de l'*Annexe — Droit de rétractation* remise au client, qui contient l'information obligatoire, le formulaire type et la demande expresse d'exécution immédiate. La *Note interne — Droit de rétractation* précise dans quels cas la joindre.

Attention toutefois à une limite : la demande d'exécution immédiate autorise à **commencer les travaux** et permet de facturer l'avancement au prorata en cas de rétractation, mais elle **ne lève pas l'interdiction de l'article L. 221-10** de recevoir un paiement avant le septième jour suivant la conclusion d'un contrat hors établissement. Si la signature a lieu chez le client, l'acompte doit donc être appelé au huitième jour.

L'alternative — signer entièrement à distance et espérer que le texte ne s'applique pas — laisse planer un risque de rétractation pendant douze mois après un projet livré et payé.

### B2. Valeur du devis et information précontractuelle

Un devis signé vaut contrat. Il doit décrire la prestation avec suffisamment de précision pour que l'objet du contrat soit déterminé : c'est le rôle du cahier des charges annexé.

Les conditions générales ne sont **opposables que si le client en a eu connaissance et les a acceptées**. Elles doivent donc être jointes au devis, avec une mention d'acceptation explicite au-dessus de la signature — et non publiées seulement sur un site.

### B3. Délais de paiement et retard

- Délai de paiement **plafonné à soixante jours** à compter de l'émission de la facture en relations entre professionnels, ou quarante-cinq jours fin de mois par convention. Les trente jours pratiqués sont conformes.
- Pénalités de retard dues **de plein droit**, sans mise en demeure, au taux convenu ou à défaut au taux légal majoré.
- **Indemnité forfaitaire de 40 €** pour frais de recouvrement, article L. 441-10 du Code de commerce. Elle doit être mentionnée.

### B4. Limites aux clauses de responsabilité ⚠️

Une **exonération totale** de responsabilité est nulle : elle vide le contrat de sa substance. Un **plafonnement** est en revanche valable, à condition de ne pas créer un déséquilibre significatif au sens de l'article L. 442-1 du Code de commerce.

Le plafond retenu aux conditions générales — total des sommes perçues sur les douze derniers mois — est un standard du secteur et reste proportionné. Deux garde-fous : aucun plafonnement ne peut couvrir une faute lourde ou dolosive, et l'exclusion des dommages indirects doit rester lisible et limitée à ce qu'elle énumère.

---

## PARTIE C — Données personnelles

### C0. Il n'existe aucune exemption « B2B » au RGPD

Idée reçue fréquente : le RGPD ne s'appliquerait qu'aux clients particuliers. C'est faux. Le critère n'est pas la qualité du client, mais **la nature de la donnée** : toute information permettant d'identifier, directement ou indirectement, une **personne physique** relève du règlement, y compris dans un contexte professionnel.

Les coordonnées professionnelles nominatives — prénom, nom, fonction, adresse de courrier électronique du type prenom.nom@entreprise.fr, numéro de ligne directe — sont des données personnelles. La Cour de cassation a jugé le 18 juin 2025 que les courriels professionnels constituent des données personnelles. Seules les adresses génériques non nominatives, du type contact@entreprise.fr, échappent en principe à cette qualification, et encore : dès que le contexte permet de les relier à un individu, la qualification s'applique.

Deux points aggravent le cas présent :

- **Les entrepreneurs individuels et les auto-entrepreneurs sont des personnes physiques** au sens du règlement. Si le client exerce en entreprise individuelle, ses propres données sont, sans discussion possible, des données personnelles.
- Les vidéos republiées comportent **l'image et la voix du client**, données personnelles par nature, et potentiellement celles de tiers apparaissant à l'écran.

La confusion vient probablement d'un autre texte : en matière de **prospection commerciale**, le B2B est effectivement plus souple — l'intérêt légitime suffit là où le B2C exige un consentement préalable. Mais cette souplesse relève de la directive ePrivacy et de l'article L. 34-5 du Code des postes et des communications électroniques, non du RGPD, et elle ne concerne que l'envoi de sollicitations commerciales.

**Conclusion : le RGPD s'applique à ce projet.** Cela étant, il faut rester proportionné. Aucune donnée de tiers n'est collectée, aucune donnée sensible n'est traitée, aucun profilage n'est mis en œuvre, et les volumes sont faibles. La mise en conformité tient en une annexe contractuelle de deux pages et un registre — pas en un programme.

### C1. Double qualification à assumer

| Rôle | Traitements concernés | Obligations |
|---|---|---|
| **Responsable de traitement** | Prospection, gestion des clients, facturation, données du site web | Registre des traitements, information des personnes, base légale, durées de conservation |
| **Sous-traitant** | Hébergement et traitement des données pour le compte du client | **Contrat écrit obligatoire** au titre de l'article 28 du RGPD |

Un prestataire qui héberge, maintient avec accès aux serveurs, ou manipule une base de données pour le compte d'un client **est sous-traitant**. C'est exactement la situation ici.

### C2. Contrat de sous-traitance — article 28 du RGPD ⚠️

Le contrat doit être **écrit** et préciser l'objet, la durée, la nature et la finalité du traitement, le type de données et les catégories de personnes concernées. Il doit prévoir, au minimum, que le sous-traitant :

- ne traite les données que sur **instruction documentée** du responsable de traitement ;
- ne recourt pas à un **sous-traitant ultérieur** sans autorisation — attention : l'hébergeur et le service de publication en sont ;
- met en œuvre des mesures techniques et organisationnelles appropriées (article 32) ;
- assiste le responsable pour les demandes d'exercice de droits et les violations de données ;
- **supprime ou restitue** l'ensemble des données en fin de prestation.

L'absence de contrat conforme expose **les deux parties** à des sanctions. La CNIL a prononcé des amendes de 50 000 à 800 000 € pour ce seul motif.

**Action : annexer au devis un contrat de sous-traitance conforme à l'article 28.** Ce document est rédigé et disponible sous le titre *Contrat de sous-traitance de données à caractère personnel*. Deux champs restent à compléter avant signature : la liste des sous-traitants ultérieurs et la localisation de leurs données.

Données personnelles effectivement traitées dans ce projet :

| Catégorie | Exemple | Qualification |
|---|---|---|
| Identité et contact du client | Nom, email de notification | Donnée personnelle, a fortiori si le client est un entrepreneur individuel |
| Image et voix | Contenu des vidéos republiées | Donnée personnelle du client, et de tout tiers identifiable à l'écran |
| Jetons d'autorisation | Accès délégués aux comptes nominatifs | Donnée d'accès rattachée à une personne physique |
| Journaux techniques | Horodatages, identifiants de publication | Données indirectement identifiantes |

### C3. Sécurité et incidents

- **Hébergement dans l'Union européenne**, ou garanties adéquates en cas de transfert hors UE. Point à vérifier pour la passerelle de publication, dont plusieurs éditeurs sont américains.
- Chiffrement au repos des jetons d'accès et des secrets, exclusion de tout secret des journaux d'exécution.
- **Notification d'une violation de données à la CNIL sous soixante-douze heures**, avec information des personnes concernées si le risque est élevé.
- Tenue d'un registre des traitements, y compris pour une entreprise individuelle.

---

## PARTIE D — Points juridiques propres à ce projet

### D1. Conditions d'utilisation des plateformes

Violer les conditions d'utilisation d'une plateforme relève du **terrain contractuel, non du pénal**. Point essentiel : seul celui qui a **effectivement adhéré** à ces conditions peut voir sa responsabilité contractuelle engagée. Ici, c'est **le client** qui a accepté les conditions de TikTok, YouTube et Instagram, pas le prestataire.

Deux conséquences pratiques :

- l'accès doit toujours passer par une **autorisation déléguée officielle donnée par le client**, jamais par la communication d'un mot de passe. C'est déjà prévu au cahier des charges, et c'est aussi ce qui maintient le prestataire hors du champ contractuel des plateformes ;
- le risque principal encouru par le client est le **blocage ou la suspension de son compte**, non une poursuite pénale. Cela doit être écrit, et c'est le cas.

### D2. La ligne rouge : ne jamais contourner une protection technique ⚠️

Si la violation de conditions d'utilisation reste contractuelle, le **contournement d'une mesure de protection technique** — captcha, authentification, blocage actif — peut basculer dans le champ pénal au titre de l'**accès frauduleux à un système de traitement automatisé de données**, articles 323-1 et suivants du Code pénal.

Traduction opérationnelle pour le développement :

| Autorisé | À ne jamais implémenter |
|---|---|
| Interroger l'interface officielle avec l'autorisation du client | Résoudre ou contourner un captcha |
| Récupérer un contenu **public** sans authentification | S'authentifier automatiquement avec les identifiants du client |
| Respecter les limitations de débit et les signaux techniques | Rotation d'adresses IP ou usurpation d'agent pour déjouer un blocage |
| Utiliser un service tiers commercial qui assume ce rôle | Contourner un blocage explicitement mis en place |

Cette ligne doit être une règle de développement, pas une intention. Le jour où la récupération cesse de fonctionner, la tentation de « juste ajouter un contournement » sera réelle. C'est à ce moment précis que la nature du risque change.

### D3. Droit des bases de données

L'article L. 342-3 du Code de la propriété intellectuelle protège le producteur d'une base de données contre l'extraction d'une **partie substantielle** de son contenu. Le projet n'extrait que les contenus **publiés par le client lui-même**, en volume marginal au regard de la base TikTok. Le risque est faible, mais il justifie de ne jamais élargir la collecte à d'autres comptes.

### D4. Droit d'auteur sur le logiciel

Le logiciel est protégé par le droit d'auteur. L'article L. 122-6 du Code de la propriété intellectuelle réserve à l'auteur la reproduction, l'adaptation et la mise sur le marché.

Deux conséquences :

- **sans clause explicite, le client ne peut légalement rien faire du code, même payé** : le droit d'auteur appartient au créateur par défaut. La licence d'utilisation concédée à l'article 10 des conditions générales n'est donc pas une faveur, c'est une nécessité ;
- toute cession de droits doit être **écrite et délimitée** — droits cédés, supports, durée, territoire, exclusivité — conformément à l'article L. 131-3. Une formule vague ne cède rien.

Le modèle retenu, conservation du socle et concession d'une licence, est cohérent avec l'objectif de réutilisation. Il doit simplement rester constant d'un client à l'autre, sous peine de créer des situations contradictoires sur un même code.

### D5. Contenus republiés

Le client est l'**éditeur** des contenus diffusés. Le prestataire fournit un outil de diffusion. La clause de garantie des conditions générales, par laquelle le client garantit détenir les droits et supporte les réclamations de tiers, est la protection adéquate.

À signaler : le client exerce une activité de **conseil en gestion de patrimoine**, secteur dont les communications à caractère promotionnel sont encadrées, avec des mentions parfois obligatoires. Ce n'est pas au prestataire de s'en assurer, mais il est prudent d'avoir écrit que cette conformité relève du client — ce que fait l'article 12 des conditions générales.

---

## PARTIE E — Actions classées par urgence

| Échéance | Action |
|---|---|
| **Avant le 1er septembre 2026** | Choisir et déclarer une **Plateforme Agréée** pour la réception des factures électroniques |
| Avant l'envoi du devis | Corriger le modèle : mention « EI », suppression des « HT », coquille des intérêts de retard |
| Avant l'envoi du devis | Joindre les conditions générales avec mention d'acceptation au-dessus de la signature |
| Avant l'envoi du devis | Joindre l'**Annexe — Droit de rétractation** (document client) : information, formulaire type, demande d'exécution immédiate |
| Si signature hors établissement | **Ne pas encaisser l'acompte avant le 8ᵉ jour** suivant la signature (article L. 221-10) |
| Avant l'encaissement de l'acompte | Faire signer le **contrat de sous-traitance RGPD** — document rédigé, deux champs à compléter |
| Avant le choix de la passerelle de publication | Documenter la **localisation des données** et les garanties de transfert hors UE à l'annexe 1 du contrat de sous-traitance |
| Avant le démarrage des travaux | Souscrire une **RC pro** couvrant les préjudices immatériels non consécutifs, en déclarant l'hébergement et la maintenance |
| Avant le démarrage des travaux | Vérifier la **localisation des données** de la passerelle de publication retenue |
| Dès la mise en service | Tenir le **registre des traitements** |
| Avant le 31 décembre 2027 | Basculer la mention TVA vers l'article L. 223-3 du CIBS |
| Avant le 1er septembre 2027 | Se doter d'une solution d'**émission** de factures électroniques et d'e-reporting |
| En continu | Suivre le cumul de chiffre d'affaires par rapport au seuil de 37 500 € |
| Règle permanente | **Aucun contournement de protection technique** dans le code, jamais |
