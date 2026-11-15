# API d’automatisation ReedBot

Cette modification ajoute une API HTTP au **même processus** que le bot. Elle est désactivée par défaut (`AUTOMATION_API_ENABLED` différent de `true`). Elle ne publie pas de mandat au démarrage. Les commandes Discord et l’API partagent les actions de publication, affectation, désaffectation et fermeture ; les boutons utilisent les mêmes transactions de candidature que l’API.

**Aucun test, démarrage du bot, appel Discord ou exécution n8n n’a été effectué pour cette PR, conformément à la demande du propriétaire.** Les endpoints sont à valider après revue et configuration. Cette PR n’est pas un déploiement Render.

## Configuration Render

Le service existant `srv-d721qlchg0os73akartg` est un **Background Worker**. Un worker ne reçoit pas les requêtes HTTP publiques de n8n. Il faut faire fonctionner ce processus comme **Web Service** pour obtenir une URL HTTPS `…onrender.com`.

1. Avant la bascule, sauvegarder le `progress.json` du worker si accessible et les variables/secret files Render. Les données Firestore restent dans le même projet Firebase.
2. Préparer le Web Service Node sur le dépôt/commit revu : build `npm ci`, start `npm start`, même configuration Discord et Firebase, **une seule instance**. Ne pas lancer un second client du même bot en parallèle du worker ; suspendre le worker pour la bascule.
3. Configurer `AUTOMATION_API_ENABLED=true`, le secret privé `AUTOMATION_API_TOKEN` et les scopes nécessaires. Le secret d’API est distinct du token Discord et du compte Firebase. Aucun secret n’est inclus dans la PR.
4. Garder `GUILD_ID`, `DISCORD_TOKEN`, `CLIENT_ID`, les canaux et rôles existants. `GOOGLE_APPLICATION_CREDENTIALS` doit désigner le secret file Firebase présent sur Render. L’API refuse de démarrer si Firebase n’est pas configuré.
5. Pour persister l’onboarding, monter un disque Render, copier le fichier existant sur ce disque puis configurer `PROGRESS_FILE=/var/data/progress.json`. Le chemin reste inchangé si la variable est absente. Ne pas choisir un fichier vide en supposant qu’il récupère les anciennes données.
6. Le serveur écoute sur `0.0.0.0:$PORT` (10000 par défaut). Liveness : `/healthz`; readiness Discord : `/readyz`. La validation et les essais restent à effectuer ultérieurement par le propriétaire.
7. Copier l’URL HTTPS du Web Service et `GUILD_ID` dans le nœud **Configuration ReedBot** des deux workflows n8n. Le credential n8n doit contenir le même secret d’API que Render.

`AUTOMATION_TUTOR_CATEGORY_ID` désigne éventuellement la catégorie des forums privés. `AUTOMATION_STAFF_ROLE_IDS` est la liste séparée par virgules des rôles RH/GO autorisés à les voir. Les administrateurs Discord conservent leur accès natif. Le tuteur concerné et le bot sont ajoutés explicitement ; `@everyone` est refusé.

## Authentification, réponses et reprise

Toutes les routes `/v1` exigent `Authorization: Bearer SECRET`. Il n’y a pas de CORS permissif ni de connexion anonyme aux données. `AUTOMATION_GUILD_IDS` limite les guildes ; si absent/vide, `GUILD_ID` est utilisé.

Les mutations exigent aussi :

```http
Content-Type: application/json
Idempotency-Key: OP001:INSTANCE:publication
X-Correlation-ID: OP001:INSTANCE
```

`Idempotency-Key` est obligatoire (160 caractères maximum, lettres/chiffres/`_.:-`). `X-Correlation-ID` est optionnel. Les identifiants Discord restent des chaînes. Le JSON est limité à 64 Kio. Limites locales : 120 requêtes authentifiées/minute et cinq mutations simultanées.

Les réponses sont synchrones, avec le statut HTTP `200` en cas de succès :

```json
{
  "data": {"shiftId":"26111501","status":"open","messageId":"DISCORD_ID"},
  "operationId":"HASH_DE_L_OPERATION",
  "replayed":false,
  "requestId":"UUID"
}
```

Les lectures renvoient `{ "data": …, "requestId": … }`. Une erreur renvoie `{ "error": { "code": "…", "message": "…", "operationId": "…" }, "requestId": "…" }` ; `operationId` n’est présent que si l’action a déjà été engagée.

Chaque mutation est enregistrée dans Firestore `automationOperations` avant ses effets. Une même clé, méthode, chemin et même contenu renvoient le résultat déjà enregistré. Un contenu différent renvoie `409 IDEMPOTENCY_CONFLICT`. Une action commencée ou interrompue renvoie `409 OPERATION_UNRESOLVED` et ne se rejoue pas automatiquement. Consulter `GET /v1/guilds/{guildId}/operations/{operationId}` et les IDs d’effets enregistrés.

Les actions qui échouent après engagement passent à `needs_review` ; un état `running` de plus de trois minutes est présenté comme `needs_review`. Il n’y a pas de worker qui rejoue ces mutations au redémarrage. Firestore et Discord ne partagent pas de transaction : une panne entre un effet Discord et son enregistrement exige une réconciliation humaine. Ne pas contourner cet état en générant une nouvelle clé pour la même action.

Erreurs courantes : `400` données invalides, `401` authentification, `403` scope/guilde interdit, `404` objet inconnu, `409` état métier incompatible, `413` corps trop grand, `415` format, `429` limite locale, `502` action interrompue, `503` bot indisponible. Les messages inattendus des SDK ne sont pas exposés au client. Les logs HTTP contiennent route, statut, requestId et operationId ; pas les corps ni les tokens.

## Scopes

Par défaut : `read,mandates:write`, suffisants pour les deux premiers workflows. Les autres actions implémentées s’autorisent avec les scopes suivants dans `AUTOMATION_API_SCOPES` :

`applications:write,tutors:write,forums:write,permissions:write,messages:write,threads:write,onboarding:write,onboarding:reset,roles:write,resources:delete`.

`GET /v1/capabilities` retourne les méthodes, chemins et scopes. Les droits effectifs restent aussi limités par les permissions du bot sur Discord. Les routes ne donnent pas un accès REST Discord arbitraire : elles couvrent les opérations métier, forums, messages et fils ci-dessous, pas la modération globale (bannissements, paiements, gestion du serveur).

## Endpoints

Sauf `/v1/status` et `/v1/capabilities`, les chemins ci-dessous sont préfixés par `/v1/guilds/{guildId}`.

| Méthode et chemin | Scope | Action / corps |
| --- | --- | --- |
| `GET /channels` | read | Canaux et types de la guilde |
| `GET /roles` | read | Rôles de la guilde |
| `GET /members?limit=50&after=ID` | read | Membres paginés, rôles et niveau tuteur |
| `GET /members/{userId}` | read | Fiche d’un membre |
| `GET /operations/{operationId}` | read | État et effets d’une mutation |
| `GET /shifts?limit=20&cursor=SHIFT_ID&status=open` | read | Mandats paginés et filtrés |
| `POST /shifts` | mandates:write | Publier un mandat (exemple plus bas) |
| `GET /shifts/{shiftId}` | read | Mandat et état courant |
| `PATCH /shifts/{shiftId}` | mandates:write | Modifier titre, début, durée, disponibilités, description, matières, référence externe |
| `GET /shifts/{shiftId}/applicants?limit=50&cursor=USER_ID&role=N1&includeWithdrawn=false` | read | Candidats par ordre de candidature |
| `GET /shifts/{shiftId}/assignment` | read | Affectation courante ou `null` |
| `POST /shifts/{shiftId}/assign` | mandates:write | `{ "tutorUserId":"ID", "selectionReason":"motif si autre candidat" }` |
| `POST /shifts/{shiftId}/unassign` | mandates:write | `{}` ; retire le précédent tuteur du fil et réouvre la carte |
| `POST /shifts/{shiftId}/close` | mandates:write | `{}` ; ferme le mandat et désactive les boutons |
| `POST /shifts/{shiftId}/reopen` | mandates:write | `{}` ; réouvre un mandat fermé sans affectation active |
| `PUT /shifts/{shiftId}/applicants/{userId}` | applications:write | `{}` ; candidature d’un tuteur éligible |
| `DELETE /shifts/{shiftId}/applicants/{userId}` | applications:write | `{}` ; retrait avant affectation |
| `POST /forums` | forums:write | `{ "name":"…", "topic":"…", "parentId":"ID", "memberIds":["ID"], "roleIds":["ID"], "private":true }` ; privé par défaut |
| `GET /forums/{forumId}` | read | Forum |
| `PATCH /forums/{forumId}` | forums:write | `{ "name":"…", "topic":"…" }` |
| `PUT /forums/{forumId}/permissions` | permissions:write | Remplace explicitement l’ACL d’un forum générique ; interdit pour un forum tuteur géré |
| `GET /forums/{forumId}/posts` | read | Actifs : `after=ID&limit=50` ; archivés : `archived=true&before=DATE_ISO&limit=50` |
| `POST /forums/{forumId}/posts` | forums:write | `{ "name":"…", "content":"…" }`, ou `embeds` |
| `PUT /tutors/{userId}/workspace` | tutors:write | `{ "name":"…", "parentId":"ID" }` ; crée un forum privé unique, ou retrouve l’existant |
| `GET /tutors/{userId}/workspace` | read | Mapping du forum privé |
| `PUT /tutors/{userId}/card` | tutors:write | `{ "name":"Profil du tuteur", "content":"…" }` ; carte permanente épinglée dans le forum privé |
| `GET /tutors/{userId}/card` | read | IDs de la carte |
| `PUT /tutors/{userId}/students/{studentReference}` | tutors:write | `{ "name":"Dossier élève", "content":"…" }` ; post permanent épinglé, création ou mise à jour |
| `GET /tutors/{userId}/students` | read | Liste des posts élèves, maximum 100, indicateur `truncated` |
| `GET /tutors/{userId}/students/{studentReference}` | read | IDs et état du post permanent |
| `POST /tutors/{userId}/students/{studentReference}/transfer` | tutors:write | `{ "targetTutorId":"ID" }` ; copie le message initial vers le forum du remplaçant et garde la source |
| `DELETE /tutors/{userId}/students/{studentReference}` | resources:delete | `{ "replacementTutorId":"ID" }` ; exige un post de remplacement prêt et un forum privé cohérent |
| `GET /members/{userId}/onboarding` | read | Étape, tentatives, rôle et `n2Ready` |
| `POST /members/{userId}/onboarding/resume` | onboarding:write | `{ "channelId":"ID" }` ; envoie l’étape courante, sans valider les quiz |
| `POST /members/{userId}/onboarding/reset` | onboarding:reset | `{}` ; progression et quiz en mémoire remis à zéro |
| `POST /members/{userId}/onboarding/reset-roles` | onboarding:reset | `{}` ; retire les rôles N1/N1A/N2 configurés |
| `PUT /members/{userId}/roles/{roleKey}` | roles:write | `{}` ; rôles métier configurés uniquement ; N2 reste attribué par les quiz |
| `DELETE /members/{userId}/roles/{roleKey}` | roles:write | `{}` ; retrait d’un rôle métier configuré |
| `GET /channels/{channelId}/messages?limit=50&before=ID` | read | Messages, notamment les réponses dans un post élève |
| `POST /channels/{channelId}/messages` | messages:write | `{ "content":"…" }` ou `embeds` |
| `PATCH /channels/{channelId}/messages/{messageId}` | messages:write | Modifie un message du bot uniquement |
| `DELETE /channels/{channelId}/messages/{messageId}` | resources:delete | `{}` ; supprime ce message précis |
| `POST /channels/{channelId}/threads` | threads:write | `{ "name":"…", "memberIds":["ID"] }` ; fil privé d’un canal texte |
| `GET /threads/{threadId}` | read | Fil ou post de forum |
| `PATCH /threads/{threadId}` | threads:write | `{ "name":"…", "archived":false, "locked":false }` |
| `GET /threads/{threadId}/members` | read | Membres du fil |
| `PUT /threads/{threadId}/members/{userId}` | threads:write | `{}` ; ajout au fil |
| `DELETE /threads/{threadId}/members/{userId}` | threads:write | `{}` ; retrait du fil |

Les limites des listes sont bornées. `nextCursor` non nul signifie qu’il faut poursuivre la pagination, même si une page filtrée ne contient aucun élément. Les filtres de mandat/candidature s’appliquent sur une page de documents scannés afin d’éviter de nouveaux index Firestore composés. Les noms et dates ne remplacent jamais les IDs.

Les messages neutralisent les mentions par défaut. Les notifications d’affectation ne mentionnent que le tuteur visé. Les embeds génériques acceptent `title`, `description`, `color` et `fields` (`name`, `value`, `inline`) ; maximum cinq embeds et 6000 caractères cumulés.

## Exemple OP-001 : créer le mandat

```json
{
  "idFormat":"AAMMJJNN",
  "title":"Secondaire 2 — Mathématiques",
  "startDate":"2026-12-01",
  "durationHours":1.5,
  "availabilities":"Lundi et mercredi entre 18 h et 20 h",
  "description":"Besoin, objectifs, mode et conditions. Répartition hebdomadaire à préciser. Ne pas publier les coordonnées du parent dans l’offre.",
  "subjects":["Mathématiques"],
  "studentReference":"tb:STUDENT_ID",
  "externalReference":"OP001:INSTANCE"
}
```

`startDate` est une date locale sans heure (début souhaité), `durationHours` est le volume total par semaine. La création réserve l’ID avant de publier sur `CHANNEL_OFFRES` / `CHANNEL_CONTRATS` (canal texte). L’état ne devient `open` qu’après enregistrement du message Discord. L’identifiant est attribué automatiquement au moment de la réservation ; aucun ID ne doit être fourni par le client.

Les candidatures conservent l’ordre de dépôt ; un clic répété sur Postuler ne remet pas une candidature active en fin de liste. Une nouvelle candidature après retrait prend une nouvelle date. Les opérations concurrentes sur le mandat sont protégées par transactions et états de transition.

Pour affecter un tuteur, préparer le forum, la carte et le post élève. Si le mandat contient `studentReference`, l’affectation exige un post élève `ready` pour cette référence chez ce tuteur. Un autre candidat que le premier exige `selectionReason` (option `reason` dans `/shift assign`). L’API ne déduit pas la compatibilité des disponibilités : ce choix relève du processus GO.

L’affectation met à jour la carte, les boutons, le fil privé et le rôle N1A. `GET …/onboarding` permet au processus de vérifier N2 **avant la première séance**, sans imposer N2 au moment où un tuteur N1 reçoit son premier mandat. Aucun changement TutorBird, Calendar, paiement, courriel ou WhatsApp n’est ajouté par cette API.

Pour un remplacement : préparer le forum du remplaçant, transférer le post, reporter les réponses/documents utiles, désassigner puis réassigner et seulement ensuite supprimer la source. Le transfert intégré copie uniquement le message initial ; les commentaires, pièces jointes et documents additionnels se lisent avec `/messages` et se reportent explicitement. La suppression ne remplace pas cette vérification de contenu.

Le gabarit OP-009 n’était pas joint : la structure des contenus permanents reste fournie par l’appelant. Les endpoints couvrent la création et les permissions nécessaires, sans prétendre reproduire un gabarit non fourni.

## Conservation et limites connues

- L’onboarding conserve son stockage fichier synchrone, avec chemin configurable et écriture atomique. Un disque persistant et une seule instance restent nécessaires ; cette PR ne migre pas les anciennes progressions vers Firestore.
- Les opérations et mappings sont dans Firestore. Les enregistrements contiennent les résultats métier utiles ; définir leur politique de conservation avant d’augmenter les volumes.
- Une action Discord/Firestore interrompue peut laisser un état partiel marqué `needs_review`, qui bloque les nouvelles transitions automatiques sur ce mandat. Résoudre les effets et le document concerné avant de reprendre ; pas de commande de déverrouillage aveugle.
- La fermeture désactive les candidatures ; elle ne supprime pas une affectation active. La désaffectation se fait explicitement avec `/unassign`.
- Les anciens mandats suivent le même format de référence que les nouveaux (`A-Z`, chiffres, `_.:-`, maximum 120 caractères). Si un ancien ID personnalisé utilise d’autres caractères, le migrer explicitement plutôt que le deviner.

Sources de déploiement : [Render Web Services](https://render.com/docs/web-services), [Discord Channels](https://docs.discord.com/developers/resources/channel).



## Numérotation quotidienne des mandats

La création utilise désormais **AAMMJJNN** : `26111501`, `26111502`, etc., pour le 15 novembre 2026. Le jour est calculé dans le fuseau `America/Toronto` au moment de la réservation, indépendamment de `startDate` (début souhaité des séances).

`NN` va de `01` à `99` et repart à `01` le lendemain. Au-delà de 99 réservations dans la journée, la création échoue explicitement avec `DAILY_SHIFT_LIMIT`.

Le bot lit le compteur de la guilde et les IDs existants de huit chiffres correspondant au jour, puis réserve le suivant **dans la même transaction Firestore que la création du document du mandat**. Deux créations simultanées obtiennent deux numéros distincts. Le compteur persiste dans `guilds/{guildId}/automationCounters/shifts-AAAA-MM-JJ`. Les anciens IDs aléatoires à six chiffres restent utilisables pour consulter/assigner les mandats existants et ne sont pas renumérotés.

Un numéro réservé reste consommé si la publication est interrompue ou si un ancien mandat est supprimé. Des trous sont possibles ; aucun numéro potentiellement déjà publié n’est réutilisé. Les lectures du compteur ne publient aucun message et aucune action Discord n’est exécutée dans le callback de transaction.

`/shift post` ne propose plus le champ `shift_id`. Les autres commandes (`applicants`, `assign`, etc.) continuent de demander l’ID du mandat déjà créé. L’API `POST /shifts` rejette un champ `shiftId` fourni par l’appelant. Le champ facultatif `idFormat: "AAMMJJNN"` permet à une automatisation de refuser un ancien serveur qui ne prend pas encore en charge cette numérotation. La clé d’idempotence reste obligatoire et indépendante du numéro : rejouer une création réussie restitue le même résultat sans consommer un numéro.

Réponse de création : `data.shiftId`, `data.idFormat`, `data.idDate`, `data.sequenceNumber`, `data.idTimeZone`, ainsi que le message Discord et ses liens. Les intégrations doivent conserver le `shiftId` retourné plutôt que le deviner.

Aucun test ni création de mandat n’a été lancé pour ce changement.


## Réservation des numéros sans index de requête

Le compteur AAMMJJNN est réservé dans une transaction Firestore avec le document du mandat. Pour chaque tentative, le bot lit directement le compteur et les 99 identifiants possibles du jour (`01` à `99`) via `Transaction.getAll`. Il prend le maximum du compteur et des documents déjà présents, puis crée le suivant atomiquement. Aucun filtre, tri ou index de requête n’est requis ; un ancien ID à six chiffres n’est pas modifié. Le coût est de 100 lectures de documents par tentative de transaction, auxquelles s’ajoutent les écritures si la réservation aboutit.

Une erreur technique pendant la réservation produit un événement serveur `shift_id_reservation_failed` avec le code, le détail SDK limité, la date et l’operationId, sans corps de requête ni credentials. Ce détail sert au diagnostic dans les logs Render ; la réponse HTTP publique garde son erreur générique.

En cas de `needs_review`, consulter d’abord l’opération via `GET /v1/guilds/{guildId}/operations/{operationId}`. Un HTTP 502 et un code interne 9 ne suffisent pas à conclure qu’un index est la cause : le code indique une précondition non satisfaite. Ne pas relancer automatiquement ni effacer une opération ayant une étape/effet de publication ou un message Discord. Ce correctif ne réarme et ne supprime aucune opération existante.

Références : [Transaction.getAll](https://googleapis.dev/nodejs/firestore/latest/Transaction.html#getAll), [codes d’erreur Firestore](https://docs.cloud.google.com/firestore/native/docs/use-rest-api#error_codes), [index Firestore](https://firebase.google.com/docs/firestore/query-data/index-overview).
