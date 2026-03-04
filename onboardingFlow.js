// Définition complète du flow d'onboarding Centre Reed
const config = require('./config');

module.exports = {
  // ============================================
  // NIVEAU 1 - Outils & Appariement
  // Commande: /start_onboarding
  // Résultat: Rôle Tuteur N1 → Accès #appliquer-à-un-contrat
  // ============================================

  'N1-01': {
    id: 'N1-01',
    level: 1,
    title: '🎯 Bienvenue au Centre Reed - Formation Niveau 1',
    description: 'Bienvenue ! Tu vas maintenant apprendre à utiliser nos **outils** et comprendre le **processus d\'appariement**.\n\n**Ce que tu vas accomplir :**\n• Découvrir Discord et TutorBird\n• Comprendre le processus d\'appariement\n• Apprendre à postuler aux offres\n• Débloquer le rôle **Tuteur - Niveau 1**',
    fields: [
      { name: '⏱️ Durée', value: '10-15 minutes' },
      { name: '🎯 Objectif', value: 'Obtenir le rôle **Tuteur N1** et accéder à #appliquer-à-un-contrat' },
    ],
    buttons: [
      { id: 'btn_N1_start', label: '🚀 Commencer', style: 'Primary' },
    ],
    nextStep: 'N1-02',
  },

  'N1-02': {
    id: 'N1-02',
    level: 1,
    title: 'Vidéo 1 — Outils (Discord & TutorBird)',
    description: 'Découvre les deux outils principaux que tu utiliseras en tant que tuteur au Centre Reed.',
    fields: [
      { name: 'Lien', value: '🎬 [Regarder la vidéo](https://youtu.be/ham62aTgKw0)' },
      { name: '📱 Discord', value: 'Processus d\'appariement, comment postuler aux offres (bidding), navigation dans les canaux' },
      { name: '💻 TutorBird', value: 'Email de confirmation après acceptation, Dashboard, Calendrier, Ressources, Paies' },
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
    title: 'Quiz — Outils (Discord & TutorBird)',
    description: 'Teste tes connaissances sur les outils que tu vas utiliser.',
    questions: [
      {
        q: 'Où postules-tu aux offres d\'élèves ?',
        options: [
          'Sur le site web Centre Reed',
          'Dans le canal #appliquer-à-un-contrat sur Discord',
          'Par courriel à la direction',
          'Sur TutorBird directement',
        ],
        correctIndex: 1,
      },
      {
        q: 'Comment postuler à une offre ?',
        options: [
          'Envoyer un courriel',
          'Cliquer sur le bouton "Postuler" sous l\'offre',
          'Écrire un message dans le thread',
          'Remplir un formulaire externe',
        ],
        correctIndex: 1,
      },
      {
        q: 'À quoi sert TutorBird ?',
        options: [
          'Discuter avec les élèves',
          'Gérer les séances, suivis et paies',
          'Créer des devoirs auto-corrigés',
          'Postuler aux offres',
        ],
        correctIndex: 1,
      },
      {
        q: 'Quand reçois-tu l\'accès à TutorBird ?',
        options: [
          'Dès la fin de cette formation',
          'Après avoir été accepté à une offre',
          'Après 1 mois de tutorat',
          'Il faut en faire la demande',
        ],
        correctIndex: 1,
      },
    ],
    passMessage: '✅ Parfait ! Tu es prêt pour la suite.',
    failMessage: '❌ Revois la vidéo et réessaie.',
    onPass: {
      nextStep: 'N1-04',
    },
    onFail: {
      retryStep: 'N1-02',
    },
  },

  'N1-04': {
    id: 'N1-04',
    level: 1,
    title: '🎉 Formation Niveau 1 Complétée !',
    description: 'Félicitations ! Tu as terminé la première étape de ta formation.',
    fields: [
      { name: '✅ Ce que tu as appris', value: '• Navigation Discord et processus d\'appariement\n• Utilisation de TutorBird\n• Comment postuler aux offres' },
      { name: '🎁 Récompense', value: 'Tu viens de recevoir le rôle **Tuteur - Niveau 1** !' },
      { name: '🔓 Accès débloqué', value: 'Tu peux maintenant voir et postuler aux offres dans **#appliquer-à-un-contrat**' },
      { name: '➡️ Prochaine étape', value: 'Une fois que tu seras **accepté à une offre**, tu recevras le rôle **Tuteur - Apparié (N1A)**.\n\nTu pourras alors continuer ta formation avec `/finish_onboarding` pour apprendre à animer tes séances !' },
    ],
    buttons: [
      { id: 'btn_N1_complete', label: '🎓 Terminer', style: 'Success' },
    ],
    onSuccess: {
      nextStep: null,
      addRoles: ['tuteurN1'],
      message: '🎉 **Tu es maintenant Tuteur - Niveau 1 !**\n\n🔓 Accès débloqué : <#' + config.channels.contrats + '>\n\n**Prochaine étape :** Postule à une offre et attends d\'être accepté pour continuer ta formation ! 💙',
    },
  },

  // ============================================
  // NIVEAU 1A - Séances (Tuteurs Appariés)
  // Commande: /finish_onboarding (requiert rôle N1A)
  // Résultat: Garde le rôle N1A
  // ============================================

  'N1A-01': {
    id: 'N1A-01',
    level: '1A',
    title: '🎉 Félicitations pour ton appariement !',
    description: 'Bravo ! Tu as été accepté à une offre et tu es maintenant **Tuteur - Apparié (N1A)**.\n\nCette formation te préparera à donner tes premières séances avec ton élève.\n\n**Ce que tu vas apprendre :**\n• Comment préparer ta **séance découverte** (première séance)\n• Comment animer tes **séances récurrentes**',
    fields: [
      { name: '⏱️ Durée', value: '15-20 minutes' },
      { name: '🎯 Objectif', value: 'Maîtriser le déroulement des séances avant de rencontrer ton élève' },
    ],
    buttons: [
      { id: 'btn_N1A_start', label: '▶️ Commencer', style: 'Primary' },
    ],
    nextStep: 'N1A-02',
  },

  'N1A-02': {
    id: 'N1A-02',
    level: '1A',
    title: 'Vidéo 1 — Séance Découverte (Première séance)',
    description: 'Apprends à préparer et animer ta toute première séance avec ton élève.',
    fields: [
      { name: 'Lien', value: '🎬 *[Vidéo à venir]*' },
      { name: '📂 Panier de l\'élève', value: 'Accès au Drive contenant les documents de l\'élève (notes, devoirs, etc.)' },
      { name: '📋 Fiche de Levin', value: 'Outil d\'évaluation du style et des forces d\'apprentissage de l\'élève' },
      { name: '🎯 Évaluation initiale', value: 'Identifier les besoins et le niveau actuel de l\'élève' },
      { name: '🔗 Démarrer', value: 'Créer le lien avec l\'élève et établir un climat de confiance' },
    ],
    buttons: [
      { id: 'btn_N1A_v1_done', label: '🎥 Vidéo 1 vue', style: 'Primary' },
    ],
    nextStep: 'N1A-03',
  },

  'N1A-03': {
    id: 'N1A-03',
    level: '1A',
    type: 'quiz',
    title: 'Quiz — Séance Découverte',
    description: 'Vérifie ta compréhension de la préparation de la première séance.',
    questions: [
      {
        q: 'Avant la première séance, tu dois consulter :',
        options: [
          'Uniquement l\'email de confirmation',
          'Le panier de l\'élève et la fiche de Levin',
          'Les notes de l\'ancien tuteur',
          'Le bulletin de l\'école',
        ],
        correctIndex: 1,
      },
      {
        q: 'La fiche de Levin sert à :',
        options: [
          'Calculer les notes de l\'élève',
          'Évaluer le style et les forces d\'apprentissage',
          'Planifier les vacances',
          'Corriger les exercices',
        ],
        correctIndex: 1,
      },
      {
        q: 'L\'objectif principal de la séance découverte est de :',
        options: [
          'Finir tous les devoirs en retard',
          'Créer le lien et évaluer les besoins de l\'élève',
          'Enseigner toute la matière manquée',
          'Parler uniquement avec le parent',
        ],
        correctIndex: 1,
      },
    ],
    passMessage: '✅ Excellent ! Passons aux séances récurrentes.',
    failMessage: '❌ Revois la vidéo et réessaie.',
    onPass: {
      nextStep: 'N1A-04',
    },
    onFail: {
      retryStep: 'N1A-02',
    },
  },

  'N1A-04': {
    id: 'N1A-04',
    level: '1A',
    title: 'Vidéo 2 — Séances Récurrentes',
    description: 'Découvre comment structurer tes séances régulières après la séance découverte.',
    fields: [
      { name: 'Lien', value: '🎬 *[Vidéo à venir]*' },
      { name: '✅ Présence', value: 'Confirmer la présence de l\'élève et noter dans TutorBird' },
      { name: '🔄 Rappel', value: 'Revoir la séance précédente et faire le lien' },
      { name: '📊 Mise à jour élève', value: 'Demander comment s\'est passée la semaine (école, devoirs, examens)' },
      { name: '📚 Adapter', value: 'Alterner entre théorie et exercices selon les besoins' },
      { name: '🎓 Teach-back', value: 'Faire expliquer les concepts par l\'élève pour valider la compréhension' },
      { name: '💬 Récap + Feedback', value: 'Résumer la séance et noter le feedback dans TutorBird' },
    ],
    buttons: [
      { id: 'btn_N1A_v2_done', label: '🎥 Vidéo 2 vue', style: 'Primary' },
    ],
    nextStep: 'N1A-05',
  },

  'N1A-05': {
    id: 'N1A-05',
    level: '1A',
    type: 'quiz',
    title: 'Quiz — Séances Récurrentes',
    description: 'Valide ta compréhension du déroulement des séances.',
    questions: [
      {
        q: 'Au début de chaque séance, tu dois :',
        options: [
          'Commencer directement les exercices',
          'Confirmer la présence et faire un rappel de la séance précédente',
          'Parler uniquement de la nouvelle matière',
          'Donner un examen surprise',
        ],
        correctIndex: 1,
      },
      {
        q: 'Le "teach-back" consiste à :',
        options: [
          'Répéter la matière plusieurs fois',
          'Faire expliquer les concepts par l\'élève',
          'Donner des devoirs supplémentaires',
          'Regarder des vidéos YouTube',
        ],
        correctIndex: 1,
      },
      {
        q: 'En fin de séance, tu dois :',
        options: [
          'Partir immédiatement',
          'Faire un récap et noter le feedback dans TutorBird',
          'Attendre que le parent arrive',
          'Donner un examen',
        ],
        correctIndex: 1,
      },
    ],
    passMessage: '🎉 **Formation Séances complétée !**',
    failMessage: '❌ Revois la vidéo et réessaie.',
    onPass: {
      nextStep: 'N1A-06',
    },
    onFail: {
      retryStep: 'N1A-04',
    },
  },

  'N1A-06': {
    id: 'N1A-06',
    level: '1A',
    title: '✅ Formation Séances Complétée !',
    description: 'Bravo ! Tu maîtrises maintenant le déroulement des séances.',
    fields: [
      { name: '✅ Ce que tu as appris', value: '• Préparer et animer une séance découverte\n• Structurer tes séances récurrentes\n• Utiliser le panier de l\'élève et la fiche de Levin\n• Noter le feedback dans TutorBird' },
      { name: '🎯 Tu es prêt', value: 'Tu peux maintenant donner tes premières séances avec confiance !' },
      { name: '➡️ Dernière étape', value: 'Quand tu veux, tu peux faire la **Formation Niveau 2** avec `/complete_training` pour apprendre la **Méthode Centre Reed** et devenir **Tuteur Actif (N2)** !' },
    ],
    buttons: [
      { id: 'btn_N1A_complete', label: '🎓 Terminer', style: 'Success' },
    ],
    onSuccess: {
      nextStep: null,
      addRoles: [], // Pas de nouveau rôle, garde N1A
      message: '🎉 **Formation Séances complétée !**\n\nTu es prêt à donner tes premières séances ! 🎓\n\n**Prochaine étape :** Tape `/complete_training` pour faire la Formation Niveau 2 et apprendre la **Méthode Centre Reed** ! 💙',
    },
  },

  // ============================================
  // NIVEAU 2 - Méthode Centre Reed
  // Commande: /complete_training (requiert rôle N1A)
  // Résultat: Rôle Tuteur N2 → Accès #équipe
  // ============================================

  'N2-01': {
    id: 'N2-01',
    level: 2,
    title: '🎓 Formation Finale - Méthode Centre Reed',
    description: 'Bienvenue à la dernière étape de ta formation !\n\nTu vas maintenant découvrir la **méthode pédagogique Centre Reed** qui te permettra d\'adapter ton enseignement selon les besoins de chaque élève.\n\n**Ce que tu vas apprendre :**\n• La méthode pour le **rattrapage**\n• La méthode pour l\'**enrichissement**\n• Les **bonnes pratiques** professionnelles',
    fields: [
      { name: '⏱️ Durée', value: '10-15 minutes' },
      { name: '🎯 Objectif', value: 'Obtenir le rôle **Tuteur N2 (Actif)** et accéder à #équipe' },
    ],
    buttons: [
      { id: 'btn_N2_start', label: '▶️ Commencer', style: 'Primary' },
    ],
    nextStep: 'N2-02',
  },

  'N2-02': {
    id: 'N2-02',
    level: 2,
    title: 'Vidéo 1 — Méthode Centre Reed',
    description: 'Découvre notre approche pédagogique unique pour le rattrapage et l\'enrichissement.',
    fields: [
      { name: 'Lien', value: '🎬 *[Vidéo à venir]*' },
      { name: '📉 Rattrapage', value: 'Méthode pour aider les élèves en difficulté à combler leurs lacunes et retrouver confiance' },
      { name: '📈 Enrichissement', value: 'Méthode pour stimuler les élèves avancés et développer leur plein potentiel' },
      { name: '⚠️ Annulations', value: 'Préavis obligatoire de **24 heures** pour toute annulation ou déplacement' },
      { name: '💰 Paies', value: 'Consulter la section **Paies** dans TutorBird pour suivre tes paiements' },
      { name: '💬 Support', value: 'Écris dans **#support** sur Discord ou contacte ton **superviseur académique** pour toute question' },
    ],
    buttons: [
      { id: 'btn_N2_video_done', label: '🎥 Vidéo vue', style: 'Primary' },
    ],
    nextStep: 'N2-03',
  },

  'N2-03': {
    id: 'N2-03',
    level: 2,
    type: 'quiz',
    title: 'Quiz — Méthode Centre Reed',
    description: 'Dernier quiz pour valider ta formation complète !',
    questions: [
      {
        q: 'La méthode Centre Reed pour le rattrapage vise à :',
        options: [
          'Faire uniquement des exercices répétitifs',
          'Combler les lacunes et redonner confiance à l\'élève',
          'Avancer plus vite dans le programme',
          'Se concentrer uniquement sur les examens',
        ],
        correctIndex: 1,
      },
      {
        q: 'Quel est le délai minimum pour annuler ou déplacer une séance ?',
        options: ['6 heures', '12 heures', '24 heures', '48 heures'],
        correctIndex: 2,
      },
      {
        q: 'Où vérifier tes paiements ?',
        options: [
          'Google Drive',
          'Section Paies dans TutorBird',
          'Message Discord',
          'Site web Centre Reed',
        ],
        correctIndex: 1,
      },
      {
        q: 'Si tu as une question ou un problème, que fais-tu ?',
        options: [
          'Attendre la fin du mois',
          'Contacter directement le parent',
          'Écrire dans #support ou contacter ton superviseur',
          'Ne rien faire',
        ],
        correctIndex: 2,
      },
    ],
    passMessage: '🏅 **Formation complète réussie !**',
    failMessage: '❌ Revois la vidéo et réessaie.',
    onPass: {
      nextStep: 'N2-04',
    },
    onFail: {
      retryStep: 'N2-02',
    },
  },

  'N2-04': {
    id: 'N2-04',
    level: 2,
    title: '🏆 Toutes nos félicitations !',
    description: 'Tu as terminé l\'intégralité de la formation Centre Reed !',
    fields: [
      { name: '✅ Tu as appris', value: '• Les outils Discord et TutorBird\n• Comment préparer et animer tes séances\n• La méthode pédagogique Centre Reed\n• Les bonnes pratiques professionnelles' },
      { name: '🎁 Récompense finale', value: 'Tu viens de recevoir le rôle **Tuteur - Niveau 2 (Actif)** !' },
      { name: '🔓 Accès débloqué', value: 'Tu as maintenant accès au canal **#équipe** pour échanger avec toute l\'équipe de tuteurs !' },
      { name: '💙 Bienvenue', value: 'Tu fais maintenant officiellement partie de l\'équipe Centre Reed. Bon tutorat !' },
    ],
    buttons: [
      { id: 'btn_N2_complete', label: '🎉 Terminer la formation', style: 'Success' },
    ],
    onSuccess: {
      nextStep: null,
      addRoles: ['tuteurN2'],
      message: '🎉 **Tu es maintenant Tuteur - Niveau 2 (Actif) !**\n\n🔓 Accès débloqué : <#' + config.channels.equipe + '>\n\n**Tu es prêt à enseigner avec toute la rigueur Reed !** 💙\n\nBienvenue dans l\'équipe ! 🎓',
    },
  },
};
