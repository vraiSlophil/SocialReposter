# Cahier des charges

**Annexe technique et fonctionnelle au devis n° [……]**
**Objet : automatisation de la republication de contenus vidéo depuis TikTok**

|                     |                                    |
| ------------------- | ---------------------------------- |
| Client              | Dimitri Laroutis EI 82744172600029 |
| Prestataire         | Nathan OUDER EI 93006911700016     |
| Version du document | 1.0 — [date]                       |

---

## Définitions

**Termes employés dans l'ensemble du document :**

| Terme               | Signification                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| **le Prestataire**  | Nathan OUDER, entrepreneur individuel, signataire du devis en qualité de fournisseur de la prestation          |
| **le Client**       | Dimitri Laroutis, signataire du devis en qualité de bénéficiaire de la prestation                              |
| **le Logiciel**     | L'ensemble applicatif développé par le Prestataire au titre de la présente prestation                          |
| **le Service**      | Le Logiciel en fonctionnement, hébergé et supervisé par le Prestataire au titre de l'abonnement d'exploitation |
| **les Plateformes** | TikTok, YouTube et Instagram, ainsi que tout service tiers nécessaire à l'exécution du Service                 |
| **la Recette**      | L'opération de vérification de conformité définie à l'article 9                                                |

---

## 1. Objet de la prestation

Le Logiciel a pour objet de supprimer toute opération manuelle de republication des contenus vidéo du Client.

Le Client publie une vidéo sur TikTok selon son usage habituel. Aucune action complémentaire n'est requise de sa part. Le Logiciel détecte la publication, récupère le contenu et procède à sa republication sur les plateformes de destination.

```
Publication manuelle par le Client sur TikTok
        ↓
    (fin des actions du Client)
        ↓
Détection de la nouvelle publication par le Logiciel
        ↓
Récupération du fichier vidéo et des métadonnées
        ↓
Republication sur YouTube et Instagram
```

Le Logiciel fonctionne de manière continue et autonome. Il ne requiert du Client ni ouverture d'un outil, ni action de validation, ni ressaisie de contenu.

---

## 2. Plateformes concernées

| Plateforme | Rôle                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| TikTok     | Source unique et point d'entrée du traitement. Les publications y demeurent manuelles et à l'initiative du Client. |
| YouTube    | Plateforme de destination, format Shorts                                                                           |
| Instagram  | Plateforme de destination, format Reels                                                                            |

---

## 3. Fonctionnalités livrées

**3.1 Détection automatique.** Le Logiciel surveille le compte TikTok autorisé par le Client et identifie chaque nouvelle publication vidéo.

**3.2 Unicité de traitement.** Le Logiciel garantit qu'une même vidéo ne peut faire l'objet de plusieurs publications sur une même plateforme de destination, y compris après interruption du service, redémarrage du serveur ou nouvelle analyse complète du compte source.

**3.3 Reprise des métadonnées.** La description rédigée sur TikTok est reprise sur les plateformes de destination, sous réserve des seules adaptations imposées par celles-ci : longueur maximale autorisée et titre YouTube dérivé de la première ligne de la description.

**3.4 Exclusion volontaire.** Un marqueur convenu entre les parties, inséré par le Client dans la description TikTok, exclut la vidéo concernée de la republication. Cette exclusion ne requiert aucune action complémentaire du Client.

**3.5 Traitement des incidents.** En cas d'indisponibilité temporaire d'une Plateforme, le Logiciel procède automatiquement à de nouvelles tentatives. En cas d'échec définitif, une alerte est adressée par courrier électronique à l'adresse désignée par le Client.

**3.6 Sauvegardes et purge.** Les données de fonctionnement font l'objet d'une sauvegarde quotidienne automatisée. Les fichiers vidéo sont supprimés automatiquement une fois les republications effectuées.

---

## 4. Reproduction à l'identique des contenus

**4.1 Aucune modification du contenu.** Le Logiciel republie les contenus **tels qu'ils ont été publiés par le Client sur TikTok**. Ne sont ni effectués, ni prévus, ni développés :

- la modification, la retouche, le recadrage, le rognage ou le réencodage de l'image ;
- la modification, le remplacement, la suppression ou l'atténuation de la bande sonore ;
- l'ajout, la suppression ou la modification de sous-titres, d'incrustations ou de mentions ;
- la suppression du filigrane éventuellement apposé par TikTok ;
- la réécriture, la traduction ou la reformulation des descriptions et des titres.

Les seules opérations effectuées sur les métadonnées sont **strictement techniques** et imposées par les plateformes de destination : troncature d'une description excédant la longueur maximale autorisée, dérivation d'un titre à partir de la description, et choix du format de publication selon la durée.

**4.2 Aucun mécanisme de validation.** Le Logiciel ne comporte aucune fonction de relecture, de validation, de vérification, de sélection ni de modération des contenus, et aucune n'est développée au titre de la présente prestation.

**4.3 Déclenchement du traitement.** Conformément à la demande du Client, la publication d'une vidéo sur TikTok constitue le **déclencheur unique** du traitement et vaut instruction de republication sur les plateformes de destination configurées. Aucune seconde validation n'est demandée.

Une vidéo publiée sur TikTok est donc republiée automatiquement, sans relecture préalable. Le marqueur d'exclusion prévu à l'article 3.4 constitue le seul moyen d'empêcher une republication.

---

## 5. Limites du Service

Les limites ci-dessous sont imposées par les Plateformes et ne relèvent pas d'un choix du Prestataire.

| Élément                                                 | Limite applicable                                                                                                                                                                                                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Délai entre la publication TikTok et les republications | Inférieur à trente minutes en fonctionnement nominal, hors indisponibilité d'une Plateforme                                                                                                                                                              |
| Publications automatiques sur YouTube                   | Six vidéos par jour au maximum, au titre du quota par défaut appliqué par Google. Une demande d'extension de quota, gratuite mais sans délai garanti, serait nécessaire au-delà. Cette démarche est exclue du périmètre.                                 |
| Publications automatiques sur Instagram                 | Vingt-cinq publications par période de vingt-quatre heures au maximum                                                                                                                                                                                    |
| Format vidéo                                            | Vidéos verticales. Au-delà de trois minutes, la publication YouTube s'effectue en vidéo standard et non en format Shorts. Lorsque la durée excède les limites acceptées par Instagram, la publication est omise sur cette seule plateforme et consignée. |
| Publications TikTok de type diaporama photographique    | Non prises en charge : seuls les contenus vidéo sont republiés.                                                                                                                                                                                          |
| Qualité du fichier récupéré                             | Le contenu republié peut comporter le filigrane apposé par TikTok et présenter une résolution inférieure à celle du fichier d'origine, sans que cela constitue une non-conformité.                                                                       |

---

## 6. Exclusions du périmètre

Ne relèvent pas de la présente prestation :

1. la création, le montage et le sous-titrage des contenus vidéo ;
2. toute modification des contenus au sens de l'article 4.1 ;
3. la publication sur toute plateforme autre que YouTube et Instagram ;
4. la publication à destination de TikTok, qui constitue la source du traitement et non une destination ;
5. la reprise des contenus publiés antérieurement à la mise en production ;
6. l'adaptation éditoriale des descriptions par plateforme ;
7. la synchronisation postérieure à la publication : la suppression d'une vidéo sur TikTok n'entraîne pas sa suppression sur les plateformes de destination ;
8. la production de statistiques d'audience et de rapports de performance ;
9. la modération des commentaires et la gestion des messages privés ;
10. le développement d'une interface web de consultation, conformément à l'article 7 ;
11. l'obtention des comptes, droits, licences et autorisations mentionnés à l'article 8.

Ces éléments peuvent faire l'objet d'une extension ultérieure, sur devis distinct.

---

## 7. Absence d'interface utilisateur

Le fonctionnement nominal du Service ne requérant aucune interaction du Client postérieurement à sa publication TikTok, aucune interface web, aucun compte utilisateur et aucun dispositif d'authentification ne sont développés au titre de la présente prestation.

Le suivi du Service repose sur :

- une alerte automatique par courrier électronique en cas d'échec définitif d'une publication ;
- des outils d'administration en ligne de commande, exploités par le Prestataire, permettant la relance d'une publication ou son déclenchement manuel.

Le développement ultérieur d'une interface web de consultation pourra faire l'objet d'un devis distinct.

---

## 8. Éléments à fournir par le Client

Les éléments suivants constituent des prérequis indispensables au développement et au fonctionnement du Logiciel. Ils doivent être fournis préalablement au démarrage des travaux.

**8.1 Autorisation d'accès au compte TikTok.** Le Client doit accorder au Logiciel l'autorisation d'accès à son compte TikTok, selon la procédure de connexion officielle transmise par le Prestataire. Le compte du Client relevant de la catégorie Business, l'accès à l'interface officielle de TikTok est possible. Le Prestataire ne demande en aucun cas la communication d'un mot de passe : les accès reposent exclusivement sur une autorisation déléguée officielle, révocable par le Client à tout moment.

**8.2 Compte Instagram commercial.** Le Client doit disposer d'un compte Instagram commercial, de type Business, rattaché à une Page Facebook. La publication automatique depuis un compte personnel est techniquement impossible, cette restriction étant imposée par Instagram.

**8.3 Chaîne YouTube.** Le Client doit disposer d'une chaîne YouTube active et détenir les droits de publication sur celle-ci.

**8.4 Marqueur d'exclusion.** Le Client doit communiquer le marqueur retenu pour l'exclusion volontaire mentionnée à l'article 3.4.

**8.5 Adresse de notification.** Le Client doit désigner une adresse de courrier électronique destinée à recevoir les alertes prévues à l'article 3.5.

**8.6 Absence d'outil concurrent.** Le Client doit s'assurer qu'aucun autre dispositif de republication automatique n'est actif sur les comptes concernés, un tel dispositif étant susceptible de produire des publications en double.

Tout retard dans la fourniture de ces éléments décale le planning d'une durée équivalente, sans incidence sur le prix convenu.

---

## 9. Recette

Le Logiciel est réputé conforme dès lors que les conditions suivantes sont réunies sur trois vidéos réelles consécutives :

1. le Client publie une vidéo sur TikTok selon son usage habituel, sans action complémentaire ;
2. le Logiciel détecte la publication et récupère le contenu ;
3. la vidéo est publiée sur YouTube et Instagram dans un délai inférieur à trente minutes ;
4. chaque publication n'est créée qu'une seule fois ;
5. un incident provoqué donne lieu à une nouvelle tentative aboutie, puis à une alerte par courrier électronique en cas d'échec définitif.

La Recette est constatée par un procès-verbal signé des deux parties. À défaut de réserves écrites formulées par le Client dans les dix jours ouvrés suivant la mise à disposition, la Recette est réputée acquise.

Ne constituent pas des réserves recevables les demandes d'évolution, les préférences esthétiques, les besoins non exprimés au présent cahier des charges et les éléments relevant des limites de l'article 5.

---

## 10. Contrainte technique propre à TikTok

À la date du présent document, aucune interface officielle de TikTok ne permet la récupération du fichier d'une vidéo publiée depuis l'application. Les interfaces officielles donnent accès aux métadonnées et à un lien de lecture, à l'exclusion du fichier réutilisable.

La récupération repose en conséquence sur des méthodes publiques non officielles, mises en œuvre de manière **redondante** afin de limiter le risque d'interruption : le Logiciel dispose de deux méthodes distinctes et bascule automatiquement de l'une à l'autre en cas d'échec.

Il en résulte qu'une évolution technique de TikTok peut interrompre cette étape de manière temporaire ou durable. Le rétablissement relève de l'abonnement d'exploitation.

---

## 11. Droits sur les contenus et sur le Logiciel

Le Client demeure titulaire de l'intégralité des droits sur ses contenus vidéo, ses descriptions, ses données d'activité, ses comptes et sa marque.

---

## 12. Périmètre du service d'exploitation

Le Service requérant un fonctionnement continu, il est hébergé et supervisé par le Prestataire au titre de l'abonnement d'exploitation figurant au devis, lequel comprend :

- l'hébergement sur serveur dédié et la maintenance du système ;
- l'abonnement au service de publication multiplateforme ;
- la supervision du Service et le traitement des alertes ;
- les sauvegardes quotidiennes et la conservation des historiques ;
- la surveillance et le renouvellement des autorisations d'accès aux comptes du Client ;
- les mises à jour de sécurité et des dépendances ;
- l'adaptation aux évolutions des Plateformes ;
- la maintenance corrective, dans la limite d'une heure par mois.

L'abonnement d'exploitation constitue une condition de fonctionnement du Service : en son absence, le Service cesse de fonctionner.

---

## 13. Acceptation

Le Client déclare avoir pris connaissance de l'intégralité du présent cahier des charges, et en particulier de la reproduction à l'identique des contenus définie à l'article 4, des limites de l'article 5, des exclusions de l'article 6, des prérequis de l'article 8, des critères de recette de l'article 9 et de la contrainte technique de l'article 10.

|                              | Le Client | Le Prestataire |
| ---------------------------- | --------- | -------------- |
| Nom et qualité du signataire |           |                |
| Date                         |           |                |
| Signature                    |           |                |
