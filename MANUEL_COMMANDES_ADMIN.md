# Manuel des commandes admin

Ce document explique comment utiliser les commandes admin du bot Discord Centre Reed.

Il est destiné aux administrateurs qui gèrent :
- les contrats de tutorat
- l’assignation des tuteurs
- le suivi de progression dans la formation

---

## Vue d'ensemble

Le bot expose actuellement 2 groupes de commandes pour les admins :

- `/shift ...`
- `/admin ...`

Ces commandes sont :
- réservées aux administrateurs
- conçues pour être utilisées en slash commands
- retournées en privé lorsque c’est pertinent

Les anciennes commandes texte :
- `!progress`
- `!reset`
- `!reset_roles`

ne doivent plus être utilisées. Elles ont été remplacées par des slash commands.

---

## Permissions requises

Pour utiliser les commandes admin, l’utilisateur doit avoir la permission Discord :

- `Administrator`

Le bot, lui, doit aussi disposer des permissions suffisantes pour :
- envoyer des messages dans `#OFFRES`
- gérer les rôles
- créer des threads
- ajouter des membres aux threads privés

---

## Commandes `/admin`

Les commandes `/admin` servent à gérer la progression et les rôles liés à l’onboarding.

### `/admin progress`

Affiche la progression actuelle d’un utilisateur dans le parcours de formation.

**Usage :**
```text
/admin progress user:@Utilisateur
```

**Ce que la commande affiche :**
- l’étape actuelle
- le titre de l’étape
- l’état de complétion N1
- les tentatives de quiz enregistrées

**Quand l’utiliser :**
- pour vérifier où un tuteur est bloqué
- pour confirmer qu’il a bien atteint une étape précise
- pour diagnostiquer un problème de progression

---

### `/admin reset`

Réinitialise la progression d’un utilisateur dans le système d’onboarding.

**Usage :**
```text
/admin reset user:@Utilisateur
```

**Effet :**
- supprime la progression enregistrée
- remet l’utilisateur au point de départ du parcours

**Quand l’utiliser :**
- si un tuteur doit recommencer la formation
- si la progression est incohérente
- après un test interne

**Attention :**
Cette commande réinitialise la progression, mais ne retire pas automatiquement les rôles Discord.

---

### `/admin reset_roles`

Retire les rôles d’onboarding d’un utilisateur.

**Usage :**
```text
/admin reset_roles user:@Utilisateur
```

**Rôles visés :**
- `Tuteur - niveau 1`
- `Tuteur - niveau 1A`
- `Tuteur - niveau 2`

**Quand l’utiliser :**
- si un tuteur doit repartir de zéro côté rôles
- après une erreur d’attribution
- pour des tests administratifs

**Bon réflexe :**
Si tu veux remettre complètement un utilisateur à zéro, utilise :

1. `/admin reset_roles`
2. `/admin reset`

---

## Commandes `/shift`

Les commandes `/shift` servent à gérer les contrats de tutorat.

### `/shift post`

Publie un nouveau contrat dans `#OFFRES`.

**Usage :**
```text
/shift post
```

**Champs demandés :**
- `title`
- `start_date`
- `duration_hours`
- `availabilities`
- `description`
- `subjects` facultatif
- `shift_id` facultatif

**Exemple :**
```text
/shift post title:Math SN4 secondaire 4
start_date:2026-04-01
duration_hours:2
availabilities:Mardi 18h-20h, Jeudi 17h-19h
description:Eleve qui a besoin d'aide en algebra et fonctions.
subjects:Math, SN4
```

**Effet :**
- le bot publie une offre dans `#OFFRES`
- un identifiant de contrat est associé à l’offre
- les tuteurs peuvent ensuite cliquer sur `Postuler` ou `Retirer`

---

### `/shift applicants`

Affiche les candidats d’un contrat donné.

**Usage :**
```text
/shift applicants shift_id:ID_DU_SHIFT
```

**Option disponible :**
- `filter_role`
  - `N1`
  - `N1A`
  - `N2`

**Quand l’utiliser :**
- pour voir qui a postulé
- pour filtrer par niveau de tuteur
- pour préparer une assignation

---

### `/shift assign`

Assigne un tuteur à un contrat.

**Usage :**
```text
/shift assign shift_id:ID_DU_SHIFT user:@Tuteur
```

**Effets automatiques :**
- le contrat passe à l’état assigné
- la date d’assignation est enregistrée
- si le tuteur est `N1` et pas encore `N1A`, le rôle `N1A` peut lui être ajouté
- un thread privé est créé pour l’assignation

**Quand l’utiliser :**
- dès qu’un tuteur est choisi pour un contrat

---

### `/shift unassign`

Retire une assignation active.

**Usage :**
```text
/shift unassign shift_id:ID_DU_SHIFT
```

**Effet :**
- l’assignation active est désactivée
- le contrat redevient ouvert

**Quand l’utiliser :**
- si une assignation doit être annulée
- si le tuteur n’est finalement plus disponible

---

### `/shift close`

Ferme un contrat aux nouvelles candidatures.

**Usage :**
```text
/shift close shift_id:ID_DU_SHIFT
```

**Effet :**
- le contrat passe au statut `closed`
- les tuteurs ne doivent plus postuler à cette offre

---

### `/shift my`

Affiche les contrats gérés par l’admin avec des filtres utiles.

Cette commande est particulièrement utile lorsqu’il y a beaucoup de contrats.

**Usage de base :**
```text
/shift my
```

**Filtres disponibles :**
- `status`
- `year`
- `subject`
- `published_after`
- `published_before`
- `limit`

### Filtre `status`

Valeurs possibles :
- `all`
- `assigned`
- `unassigned`
- `open`
- `closed`

**Exemples :**
```text
/shift my status:assigned
/shift my status:open
/shift my status:unassigned
```

### Filtre `year`

Filtre les contrats selon leur année de publication.

**Exemple :**
```text
/shift my year:2026
```

### Filtre `subject`

Filtre par matière.

**Exemples :**
```text
/shift my subject:math
/shift my subject:francais
/shift my subject:chimie
```

### Filtres `published_after` et `published_before`

Permettent de filtrer selon la date de publication du contrat.

**Format requis :**
```text
YYYY-MM-DD
```

**Exemples :**
```text
/shift my published_after:2026-01-01
/shift my published_before:2026-06-30
/shift my published_after:2026-01-01 published_before:2026-03-31
```

### Filtre `limit`

Permet de limiter le nombre de résultats affichés.

**Exemples :**
```text
/shift my limit:10
/shift my status:assigned limit:25
```

### Ce que `/shift my` affiche

Pour chaque contrat, la commande peut montrer :
- le titre
- l’identifiant du shift
- le statut
- les matières
- la date de publication
- si applicable :
  - le tuteur assigné
  - la date d’assignation

### Exemples utiles

Voir les contrats assignés cette année :
```text
/shift my status:assigned year:2026
```

Voir les contrats de math non assignés :
```text
/shift my status:unassigned subject:math
```

Voir les contrats publiés récemment :
```text
/shift my published_after:2026-03-01 limit:20
```

---

## Flux admin recommandé

### Publier et assigner un contrat

1. Utiliser `/shift post`
2. Attendre les candidatures
3. Utiliser `/shift applicants shift_id:...`
4. Choisir un tuteur
5. Utiliser `/shift assign shift_id:... user:@Tuteur`

### Vérifier un problème d’onboarding

1. Utiliser `/admin progress user:@Utilisateur`
2. Vérifier l’étape actuelle
3. Si nécessaire :
   - `/admin reset`
   - `/admin reset_roles`

---

## Bonnes pratiques

- Utiliser les commandes slash plutôt que les anciennes commandes texte
- Vérifier l’ID du shift avant une assignation ou une fermeture
- Utiliser `/shift my` avec filtres si le volume de contrats devient élevé
- Réinitialiser les rôles et la progression séparément quand un utilisateur doit recommencer complètement
- Éviter de publier plusieurs contrats presque identiques sans titre clair

---

## Dépannage

### La commande n’apparaît pas

Vérifier :
- que les slash commands ont bien été réenregistrées
- que le bot est redémarré
- que l’utilisateur est bien admin

### La commande répond “réservée aux administrateurs”

Vérifier que l’utilisateur possède bien la permission Discord `Administrator`.

### `/shift my` ne retourne rien

Vérifier :
- que l’admin a bien publié des contrats
- que les filtres sont trop restrictifs ou non
- que les dates sont au format `YYYY-MM-DD`

### Une assignation n’ajoute pas le bon rôle

Vérifier :
- la configuration des rôles dans `.env`
- la hiérarchie des rôles Discord
- les permissions du bot

---

## Résumé rapide

### Suivi onboarding
- `/admin progress`
- `/admin reset`
- `/admin reset_roles`

### Gestion contrats
- `/shift post`
- `/shift applicants`
- `/shift assign`
- `/shift unassign`
- `/shift close`
- `/shift my`
