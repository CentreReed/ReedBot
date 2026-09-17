// Définition complète du flow d'onboarding Centre Reed
const config = require('./config');

module.exports = {
  // ============================================
  // NIVEAU 1 - Discord et offres de tutorat
  // Commande: /start_onboarding
  // Résultat: Rôle Tuteur N1 → Accès #offres + #annonces
  // ============================================

  'N1-01': {
    id: 'N1-01',
    level: 1,
    title: '🎯 Bienvenue au Centre Reed - Formation Niveau 1',
    description: 'Bienvenue ! Tu vas maintenant apprendre à utiliser **Discord**, notre espace de communication interne avec les tuteurs, et à comprendre le fonctionnement des **offres de tutorat**.\n\n**Ce que tu vas accomplir :**\n• Découvrir les différents espaces du serveur Discord\n• Comprendre où communiquer selon la situation\n• Comprendre le fonctionnement des offres et savoir comment postuler\n• Voir ce qui se passe lorsqu’un élève t’est assigné\n• Débloquer le rôle **Tuteur - niveau 1**',
    fields: [
      { name: '⏱️ Durée', value: '5-10 minutes' },
      { name: '🎯 Objectif', value: 'Obtenir le rôle **Tuteur - niveau 1** et accéder aux canaux **#offres et #annonces**' },
    ],
    buttons: [
      { id: 'btn_N1_start', label: '🚀 Commencer', style: 'Primary' },
    ],
    nextStep: 'N1-02',
  },

  'N1-02': {
    id: 'N1-02',
    level: 1,
    title: '🎥 Vidéo 1 — Discord : fonctionnement et offres de tutorat',
    description: 'Découvre le fonctionnement du serveur Discord du Centre Reed et le parcours d’un tuteur, de la consultation d’une offre jusqu’à l’assignation d’un élève.',
    fields: [
      { name: 'Lien', value: '🎬 [Regarder la vidéo](https://youtu.be/ham62aTgKw0)' },
      { name: '🖥️ Le serveur Discord', value: 'Découvre les différents espaces du serveur et apprends où communiquer selon la situation.' },
      { name: '📋 Les offres de tutorat', value: 'Apprends à lire une offre, à reconnaître son statut et à vérifier les informations importantes avant de postuler.' },
      { name: '✅ Postuler à une offre', value: 'Découvre comment soumettre ta candidature et comment la retirer si tu n’es finalement plus disponible.' },
      { name: '🎓 Lorsqu’un élève t’est assigné', value: 'Découvre ce qui se passe dans Discord lorsqu’un mandat t’est attribué et comment confirmer le créneau choisi.' },
      { name: '🚀 Poursuivre ton onboarding', value: 'Découvre comment reprendre ton onboarding lorsque ton premier élève t’est assigné.' },
      { name: '⏱️ Durée', value: '5-10 minutes' },
    ],
    buttons: [
      { id: 'btn_N1_video_done', label: '🎥 Vidéo complétée', style: 'Primary' },
    ],
    nextStep: 'N1-03',
  },

  'N1-03': {
    id: 'N1-03',
    level: 1,
    type: 'quiz',
    title: '📝 Quiz — Formation Niveau 1 : Discord',
    description: 'Valide ta compréhension des principaux éléments du fonctionnement de **Discord au Centre Reed**.\n\n🎯 **Note de passage : 100 % (5/5)**\nEn cas d’erreur, tu pourras reprendre le quiz jusqu’à l’obtention de 100 %.',
    questions: [
      {
        q: 'Tu souhaites communiquer une information concernant un élève qui t’a été assigné. Où dois-tu normalement le faire ?',
        options: [
          'Dans #offres',
          'Dans le canal ou l’espace prévu pour cet élève',
          'Dans #annonces',
          'Dans #onboarding',
        ],
        correctIndex: 1,
      },
      {
        q: 'Lorsque tu utilises les différents canaux du serveur Discord du Centre Reed, quelle règle dois-tu suivre ?',
        options: [
          'Écrire dans n’importe quel canal et laisser un administrateur déplacer le message',
          'Utiliser seulement les messages privés',
          'Utiliser le canal correspondant au sujet selon la structure présentée dans la formation',
          'Toujours écrire dans #annonces',
        ],
        correctIndex: 2,
      },
      {
        q: 'Une nouvelle carte apparaît dans #offres. Quelles informations dois-tu principalement vérifier avant de postuler ?',
        options: [
          'Le titre, la matière, la description, la date de début et les disponibilités demandées',
          'Le nombre de tuteurs et la date de publication seulement',
          'Le nom de l’administrateur et le nombre de candidats',
          'Ta date d’arrivée au Centre Reed et ton niveau de rôle',
        ],
        correctIndex: 0,
      },
      {
        q: 'Que signifie une barre verte sur une offre de tutorat ?',
        options: [
          'Le mandat est terminé',
          'Le Centre Reed a déjà sélectionné plusieurs tuteurs',
          'L’offre est ouverte et aucun tuteur n’a encore été assigné',
          'Le mandat est réservé aux nouveaux tuteurs',
        ],
        correctIndex: 2,
      },
      {
        q: 'Que signifie une barre rouge sur une offre de tutorat ?',
        options: [
          'L’offre vient d’être publiée',
          'Un tuteur a été assigné au mandat',
          'Le parent a annulé le mandat',
          'L’offre nécessite une réponse urgente',
        ],
        correctIndex: 1,
      },
    ],
    passMessage: '🎉 Tu maîtrises les principaux éléments du fonctionnement de **Discord au Centre Reed**.',
    failMessage: '❌ Revois la vidéo et réessaie.',
    onPass: { nextStep: 'N1-04' },
    onFail: { retryStep: 'N1-02' },
  },

  'N1-04': {
    id: 'N1-04',
    level: 1,
    type: 'completion',
    title: '🎉 Formation Niveau 1 complétée !',
    description: 'Félicitations ! Tu as terminé la première étape de ta formation.',
    fields: [
      { name: '✅ Ce que tu as appris', value: '• Naviguer dans les différents espaces du serveur Discord\n• Comprendre où communiquer selon la situation\n• Consulter les offres de tutorat et comprendre leur statut\n• Postuler à une offre et retirer ta candidature au besoin\n• Comprendre ce qui se passe lorsqu’un élève t’est assigné' },
      { name: '🎁 Récompense', value: 'Tu viens de recevoir le rôle **Tuteur - niveau 1** !' },
      { name: '🔓 Accès débloqué', value: 'Tu peux maintenant accéder aux canaux **#offres et #annonces** et postuler aux mandats disponibles.' },
      { name: '➡️ Prochaine étape', value: 'Lorsqu’un premier élève te sera assigné, tu recevras le rôle **Tuteur - niveau 1A**.\n\nTu devras alors confirmer le **créneau récurrent choisi** dans le post de ton nouvel élève.\n\nEnsuite, retourne dans **#onboarding** et utilise la commande `/finish_onboarding` pour compléter le reste de ta formation avant ta première séance.' },
    ],
    buttons: [
      { id: 'btn_N1_complete', label: '🎓 Terminer', style: 'Success' },
    ],
    onSuccess: {
      nextStep: null,
      addRoles: ['tuteurN1'],
      message: '🎉 Tu es maintenant **Tuteur - niveau 1** !\n\n🔓 **Accès débloqué :** **#offres et #annonces**\n\n**Prochaine étape :** Consulte les offres disponibles et postule aux mandats qui t’intéressent.\n\nLorsqu’un premier élève te sera assigné, retourne dans **#onboarding** et utilise `/finish_onboarding` pour poursuivre ta formation. 💙',
    },
  },

  // ============================================
  // NIVEAU 2 - Formation complète (N1A → N2)
  // Commande: /finish_onboarding (requiert rôle N1A)
  // Résultat: Rôle Tuteur N2 → Accès #formations-continues
  // ============================================

  'N2-01': {
    id: 'N2-01',
    level: 2,
    title: '🎉 Félicitations pour ton premier mandat !',
    description: 'Bravo ! Un premier élève t’a été assigné et tu es maintenant **Tuteur - niveau 1A**.\n\nIl est maintenant temps de compléter le reste de ta formation afin d’être prêt pour ta première séance.\n\n**Ce que tu vas apprendre :**\n• La **Méthode Reed** et notre approche du tutorat\n• Utiliser nos principaux **outils et ressources**\n• Comment réaliser une **Séance Découverte**\n• Comment préparer et réaliser les **Séances récurrentes**',
    fields: [
      { name: '⏱️ Durée', value: '1h20' },
      { name: '🎯 Objectif', value: 'Être prêt à accompagner ton premier élève selon les méthodes et le fonctionnement du Centre Reed.' },
    ],
    buttons: [
      { id: 'btn_N2_start', label: '▶️ Commencer', style: 'Primary' },
    ],
    nextStep: 'N2-02',
  },

  'N2-02': {
    id: 'N2-02',
    level: 2,
    title: '🎥 Vidéo 1 — Méthode Reed',
    description: 'Découvre l’approche pédagogique du Centre Reed et les principes qui guident notre accompagnement des élèves.',
    fields: [
      { name: 'Lien', value: '🎬 [Regarder la vidéo](https://youtu.be/_Gz4ULoTCe4)' },
      { name: 'Notre vision', value: 'Comprendre les objectifs de l’accompagnement Reed : favoriser la réussite scolaire tout en développant progressivement l’autonomie de l’élève.' },
      { name: 'Le tuteur exemplaire', value: 'Comprendre la posture attendue d’un tuteur Reed et son rôle dans l’accompagnement de l’élève.' },
      { name: 'Nos méthodes pédagogiques', value: 'Découvrir les principes et les méthodes qui guident l’accompagnement durant les séances.' },
    ],
    buttons: [
      { id: 'btn_N2_v1_done', label: '🎥 Vidéo 1 vue', style: 'Primary' },
    ],
    nextStep: 'N2-03',
  },

  'N2-03': {
    id: 'N2-03',
    level: 2,
    type: 'quiz',
    title: '📝 Quiz — Formation 1 : Méthode Reed',
    description: 'Valide ta compréhension des principaux éléments de la **Méthode Reed**.\n\n🎯 **Note de passage : 100 % (5/5)**\nEn cas d’erreur, tu pourras reprendre le quiz jusqu’à l’obtention de 100 %.',
    questions: [
      {
        q: 'Quel est l’objectif principal du Centre Reed dans l’accompagnement des élèves ?',
        options: ['Rendre l’élève autonome dans son apprentissage', 'Améliorer les notes rapidement', 'Compléter les devoirs le plus vite possible', 'Préparer uniquement les examens'],
        correctIndex: 0,
      },
      {
        q: 'Selon la vision du Centre Reed, quel est l’objectif à long terme ?',
        options: ['Augmenter la motivation scolaire', 'Développer les fonctions exécutives', 'Réussir les examens finaux', 'Compléter les devoirs sans aide'],
        correctIndex: 1,
      },
      {
        q: 'Quel élément est considéré comme la clé #1 de la réussite d’un élève ?',
        options: ['Le matériel pédagogique utilisé', 'Le nombre d’heures de tutorat', 'La relation de confiance avec le tuteur', 'La difficulté des exercices'],
        correctIndex: 2,
      },
      {
        q: 'Dans le dialogue socratique, quel est le rôle principal du tuteur ?',
        options: ['Donner directement la réponse à l’élève', 'Expliquer toute la matière avant les exercices', 'Corriger immédiatement chaque erreur', 'Poser des questions pour stimuler la réflexion de l’élève'],
        correctIndex: 3,
      },
      {
        q: 'Dans la méthode de classe inversée utilisée au Centre Reed, quel est le rôle principal de l’élève durant la séance de tutorat ?',
        options: ['Écouter les explications du tuteur avant de faire les exercices', 'Réviser la matière et répondre aux questions du tuteur', 'Observer les méthodes du tuteur pour les reproduire plus tard', 'Expliquer dans ses propres mots ce qu’il a compris de la matière déjà vue et appliquer les concepts'],
        correctIndex: 3,
      },
    ],
    passMessage: '🎉 Tu maîtrises les principaux éléments de la **Méthode Reed**.',
    failMessage: '❌ Revois la vidéo et réessaie.',
    onPass: { nextStep: 'N2-04' },
    onFail: { retryStep: 'N2-02' },
  },

  'N2-04': {
    id: 'N2-04',
    level: 2,
    title: '🎥 Vidéo 2 — Outils et ressources',
    description: 'Découvre les principaux outils utilisés au Centre Reed et apprends **où faire quoi** dans ton travail de tuteur.',
    fields: [
      { name: 'Lien', value: '🎬 [Regarder la vidéo](https://youtu.be/HwMXCejJ3Xg)' },
      { name: 'TutorBird', value: 'Consulte tes séances, accède aux liens Google Meet, prends les présences et retrouve les informations et ressources liées à tes élèves.' },
      { name: 'WhatsApp', value: 'Communique avec les parents, notamment pour les annulations et pour convenir des reprises de séance.' },
      { name: 'Google Meet', value: 'Plateforme utilisée pour réaliser les séances de tutorat en ligne.' },
      { name: 'Canva / Miro', value: 'Outils facultatifs pouvant servir de tableau blanc numérique pendant une séance.' },
    ],
    buttons: [
      { id: 'btn_N2_v2_done', label: '🎥 Vidéo 2 vue', style: 'Primary' },
    ],
    nextStep: 'N2-05',
  },

  'N2-05': {
    id: 'N2-05',
    level: 2,
    type: 'quiz',
    title: '📝 Quiz — Formation 2 : Outils et ressources',
    description: 'Valide ta compréhension des principaux **outils et ressources** utilisés au Centre Reed.\n\n🎯 **Note de passage : 100 % (5/5)**\nEn cas d’erreur, tu pourras reprendre le quiz jusqu’à l’obtention de 100 %.',
    questions: [
      {
        q: 'Tu veux consulter tes prochaines séances, accéder au lien Google Meet et enregistrer les informations liées à tes séances. Quel outil dois-tu principalement utiliser ?',
        options: ['WhatsApp', 'Discord', 'TutorBird', 'Google Drive'],
        correctIndex: 2,
      },
      {
        q: 'Un parent doit annuler une séance ou convenir avec toi d’un moment pour la reprendre. Quel outil doit principalement être utilisé pour cette communication ?',
        options: ['TutorBird', 'WhatsApp', 'Google Meet', 'Discord'],
        correctIndex: 1,
      },
      {
        q: 'Tu n’es pas certain du choix à sélectionner dans TutorBird pour enregistrer correctement une présence, une absence ou un rattrapage. Que dois-tu faire ?',
        options: ['Choisir au hasard et laisser le Centre corriger ensuite', 'Consulter la fiche rappel « TutorBird — Présences, absences et rattrapages » dans l’espace partagé', 'Demander au parent quel statut choisir', 'Sélectionner Présent par défaut et avertir le Centre'],
        correctIndex: 1,
      },
      {
        q: 'Pendant une séance en ligne, quelle pratique est attendue du tuteur et de l’élève ?',
        options: ['La caméra est normalement ouverte', 'Seul le tuteur doit ouvrir sa caméra', 'La caméra est requise seulement pendant la Séance Découverte', 'Les caméras doivent rester fermées'],
        correctIndex: 0,
      },
      {
        q: 'Tu souhaites utiliser un tableau blanc numérique pour expliquer visuellement une notion à ton élève. Quelle affirmation est correcte ?',
        options: ['Tu dois obligatoirement utiliser Discord', 'Tu peux utiliser Canva ou Miro lorsque c’est pertinent', 'Tu peux uniquement utiliser TutorBird', 'Les tableaux blancs numériques ne sont pas permis'],
        correctIndex: 1,
      },
    ],
    passMessage: '🎉 Tu maîtrises les principaux éléments des **outils et ressources** du Centre Reed.',
    failMessage: '❌ Revois la vidéo et réessaie.',
    onPass: { nextStep: 'N2-06' },
    onFail: { retryStep: 'N2-04' },
  },

  'N2-06': {
    id: 'N2-06',
    level: 2,
    title: '🎥 Vidéo 3 — Séance Découverte',
    description: 'Apprends à préparer et réaliser la **première séance avec ton élève**, afin de faire connaissance, comprendre ses besoins et obtenir un premier portrait de son niveau scolaire.',
    fields: [
      { name: 'Lien', value: '🎬 [Regarder la vidéo](https://youtu.be/VhiRuF2XwPU)' },
      { name: 'Séance Découverte', value: 'Découvre les étapes à suivre pour structurer et réaliser cette première rencontre avec l’élève.' },
      { name: 'Tableau des ressources', value: 'Présente à l’élève les ressources qui seront à sa disposition et assure-toi qu’il sait comment y accéder.' },
      { name: 'Programme de l’élève', value: 'Établis les principaux objectifs de l’accompagnement à partir des besoins observés. Le Programme pourra ensuite évoluer au fil des séances.' },
      { name: 'Évaluation des besoins', value: 'Utilise notamment les devoirs, exercices ou évaluations à préparer pour observer concrètement le niveau, les forces et les difficultés de l’élève.' },
      { name: 'Rétroaction — Séance Découverte', value: 'À la fin de la séance, complète la rétroaction dans TutorBird afin de transmettre tes observations sur l’élève et son niveau scolaire.' },
    ],
    buttons: [
      { id: 'btn_N2_v3_done', label: '🎥 Vidéo 3 vue', style: 'Primary' },
    ],
    nextStep: 'N2-07',
  },

  'N2-07': {
    id: 'N2-07',
    level: 2,
    type: 'quiz',
    title: '📝 Quiz — Formation 3 : Séance Découverte',
    description: 'Valide ta compréhension des principaux éléments de la **Séance Découverte**.\n\n🎯 **Note de passage : 100 % (5/5)**\nEn cas d’erreur, tu pourras reprendre le quiz jusqu’à l’obtention de 100 %.',
    questions: [
      {
        q: 'Quel est l’objectif principal de la Séance Découverte ?',
        options: ['Compléter un maximum d’exercices', 'Présenter tous les services du Centre Reed', 'Faire connaissance, comprendre les besoins et obtenir un premier portrait du niveau scolaire', 'Commencer immédiatement le programme régulier'],
        correctIndex: 2,
      },
      {
        q: 'Si le besoin de l’élève n’est pas urgent, que devrais-tu faire dans les premières minutes de la Séance Découverte ?',
        options: ['Faire connaissance, créer un lien, présenter le Tableau des ressources et t’assurer que l’élève sait accéder à TutorBird', 'Discuter uniquement avec le parent', 'Commencer immédiatement les exercices', 'Demander à l’élève de compléter seul son Programme'],
        correctIndex: 0,
      },
      {
        q: 'Après le premier contact, comment peux-tu concrètement évaluer le niveau et les besoins de l’élève ?',
        options: ['En consultant uniquement son bulletin', 'En demandant uniquement l’avis du parent', 'En lui faisant obligatoirement passer un test standardisé', 'En travaillant sur du matériel concret comme ses devoirs ou une évaluation à préparer'],
        correctIndex: 3,
      },
      {
        q: 'Tu dois compléter le Programme de l’élève. Où peux-tu retrouver le Programme et les ressources nécessaires pour la Séance Découverte ?',
        options: ['Dans #offres', 'Dans le dossier « Séance Découverte » de l’« Espace partagé », qui contient notamment le Programme, le Tableau des ressources et le document Séance Découverte', 'Dans le dossier Matériel didactique seulement', 'Dans les informations personnelles de TutorBird'],
        correctIndex: 1,
      },
      {
        q: 'Que dois-tu compléter dans TutorBird à la fin de la Séance Découverte ?',
        options: ['Modifier le contrat du parent', 'Créer toi-même toutes les séances récurrentes', 'La « rétroaction de la Séance Découverte » avec tes observations sur l’élève, son environnement et son niveau scolaire', 'Facturer le parent'],
        correctIndex: 2,
      },
    ],
    passMessage: '🎉 Tu maîtrises les principaux éléments de la **Séance Découverte**.',
    failMessage: '❌ Revois la vidéo et réessaie.',
    onPass: { nextStep: 'N2-08' },
    onFail: { retryStep: 'N2-06' },
  },

  'N2-08': {
    id: 'N2-08',
    level: 2,
    title: '🎥 Vidéo 4 — Séances récurrentes',
    description: 'Découvre comment préparer, structurer et assurer le suivi de tes **séances récurrentes** après la Séance Découverte.',
    fields: [
      { name: 'Lien', value: '🎬 [Regarder la vidéo](https://youtu.be/Fn5FZmhQM5Q)' },
      { name: 'Programme de l’élève', value: 'Utilise le Programme pour guider l’accompagnement et fais-le évoluer au fil des séances selon les besoins et la progression de l’élève.' },
      { name: 'Panier de l’élève', value: 'Consulte les informations et documents utiles à son accompagnement, comme son bulletin, son plan d’intervention ou les informations transmises par le parent.' },
      { name: 'Matériel didactique', value: 'Utilise les ressources disponibles pour travailler les notions et répondre aux besoins de l’élève pendant les séances.' },
      { name: 'Techniques d’étude et fonctions exécutives', value: 'Intègre, lorsque pertinent, des stratégies adaptées aux besoins observés chez l’élève afin de développer progressivement son autonomie.' },
      { name: 'Compte rendu', value: 'À la fin de chaque séance, complète le compte rendu dans TutorBird afin d’assurer le suivi de l’accompagnement.' },
    ],
    buttons: [
      { id: 'btn_N2_v4_done', label: '🎥 Vidéo 4 vue', style: 'Primary' },
    ],
    nextStep: 'N2-09',
  },

  'N2-09': {
    id: 'N2-09',
    level: 2,
    type: 'quiz',
    title: '📝 Quiz — Formation 4 : Séances récurrentes',
    description: 'Valide ta compréhension des principaux éléments des **Séances récurrentes**.\n\n🎯 **Note de passage : 100 % (5/5)**\nEn cas d’erreur, tu pourras reprendre le quiz jusqu’à l’obtention de 100 %.',
    questions: [
      {
        q: 'Avant une séance récurrente, que dois-tu consulter pour bien préparer ton accompagnement ?',
        options: ['Uniquement les messages WhatsApp', 'Le Programme ainsi que les informations et documents pertinents dans le panier de l’élève', 'Les offres disponibles sur Discord', 'Uniquement ce qui a été fait à la séance précédente'],
        correctIndex: 1,
      },
      {
        q: 'Au début d’une séance récurrente, que devrais-tu faire dans les premières minutes ?',
        options: ['Faire un retour avec l’élève, déterminer les priorités et planifier le travail de la séance', 'Laisser l’élève travailler seul pendant que tu prépares la séance', 'Remplir immédiatement le compte rendu final', 'Consulter les nouvelles offres sur Discord'],
        correctIndex: 0,
      },
      {
        q: 'Concernant le Programme de l’élève, quelle affirmation est correcte ?',
        options: ['Il est fixé après la Séance Découverte et ne doit plus être modifié', 'Il sert seulement durant les premières séances', 'Il est dynamique et peut être modifié au fil du temps selon les besoins et la progression de l’élève', 'Seul le parent peut demander qu’il soit modifié'],
        correctIndex: 2,
      },
      {
        q: 'Tu observes qu’un élève a besoin d’aide pour mieux s’organiser dans ses devoirs et ses études. Quel type de ressource peux-tu utiliser ?',
        options: ['Une fiche de fonction exécutive ou de technique d’étude adaptée à son besoin', 'Une nouvelle offre dans #offres', 'Le formulaire de Séance Découverte uniquement', 'Le compte de facturation du parent'],
        correctIndex: 0,
      },
      {
        q: 'À la fin d’une séance récurrente, où trouves-tu le compte rendu à compléter ?',
        options: ['Dans le post Discord de l’élève', 'Dans le dossier Matériel didactique', 'Dans les détails de la leçon dans TutorBird, lorsque tu cliques sur « Prendre les présences »', 'Dans le groupe WhatsApp avec le parent'],
        correctIndex: 2,
      },
    ],
    passMessage: '🎉 Tu maîtrises les principaux éléments des **Séances récurrentes**.\n\n🎓 **Tu as maintenant complété toutes les formations du Centre Reed !**',
    failMessage: '❌ Revois la vidéo et réessaie.',
    onPass: { nextStep: 'N2-10' },
    onFail: { retryStep: 'N2-08' },
  },

  'N2-10': {
    id: 'N2-10',
    level: 2,
    type: 'completion',
    title: '🎓 Formation terminée',
    description: 'Tu as terminé l’intégralité de la formation du Centre Reed.',
    fields: [
      { name: '✅ Tu as appris', value: '• La **Méthode Reed** et notre approche du tutorat\n• Comment utiliser nos principaux **outils et ressources**\n• Comment préparer et réaliser une **Séance Découverte**\n• Comment préparer, structurer et assurer le suivi de tes **Séances récurrentes**' },
      { name: '🎁 Récompense finale', value: 'Tu viens de recevoir le rôle **Tuteur - niveau 2** !' },
      { name: '🔓 Nouvel accès débloqué', value: 'Tu as maintenant accès à **#formations-continues**.' },
      { name: '🎯 Prêt pour tes séances', value: 'Tu es maintenant prêt à accompagner tes élèves selon les méthodes et le fonctionnement du Centre Reed.' },
    ],
    buttons: [
      { id: 'btn_N2_complete', label: '🎉 Terminer la formation', style: 'Success' },
    ],
    onSuccess: {
      nextStep: null,
      addRoles: ['tuteurN2'],
      message: '🎉 Tu es maintenant **Tuteur - niveau 2**.\n\n🔓 **Nouvel accès débloqué :** **#formations-continues**\n\n**Tu es maintenant prêt à commencer tes séances et à accompagner tes élèves selon la Méthode Reed. 💙**',
    },
  },
};
