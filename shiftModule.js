const shiftActions = require('./automation/shiftActions');
const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const config = require('./config');
const { listApplicants, listShiftsByCreator, listActiveAssignments } = require('./shiftStore');

const isAdmin = member => member.permissions.has(PermissionFlagsBits.Administrator);

const parseDateInput = (value, endOfDay = false) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const formatDiscordTime = (timestampMs) => {
  if (!timestampMs) return 'N/A';
  const ts = Math.floor(timestampMs / 1000);
  return `<t:${ts}:d> • <t:${ts}:R>`;
};

// Export slash command definition
const shiftCommands = [
  new SlashCommandBuilder()
    .setName('shift')
    .setDescription('Gérer les contrats de tutorat (Admins seulement)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sc =>
      sc
        .setName('post')
        .setDescription('Publier un nouveau contrat')
        .addStringOption(o => o.setName('title').setDescription('Titre du contrat').setRequired(true))
        .addStringOption(o =>
          o.setName('start_date').setDescription('Date de début (ex: 2025-11-15)').setRequired(true)
        )
        .addNumberOption(o => o.setName('duration_hours').setDescription('Durée en HEURES par semaine (ex: 1.5)').setRequired(true))
        .addStringOption(o => o.setName('availabilities').setDescription('Dispos élève (ex: Lun 18-22h, Mar 18-22h)').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('Description détaillée').setRequired(true))
        .addStringOption(o => o.setName('subjects').setDescription('Matières (séparées par virgule)').setRequired(false))
        .addStringOption(o => o.setName('shift_id').setDescription('ID personnalisé (optionnel)').setRequired(false))
    )
    .addSubcommand(sc =>
      sc
        .setName('applicants')
        .setDescription('Lister les candidats (admins)')
        .addStringOption(o => o.setName('shift_id').setDescription('ID du contrat').setRequired(true))
        .addStringOption(o => o.setName('filter_role').setDescription('Filtrer par rôle: N1, N1A ou N2').setRequired(false))
    )
    .addSubcommand(sc =>
      sc
        .setName('assign')
        .setDescription('Assigner un tuteur (admins)')
        .addStringOption(o => o.setName('shift_id').setDescription('ID du contrat').setRequired(true))
        .addUserOption(o => o.setName('user').setDescription('Tuteur à assigner').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Motif si autre candidat que le premier').setRequired(false))
    )
    .addSubcommand(sc =>
      sc
        .setName('unassign')
        .setDescription('Retirer l\'assignation (admins)')
        .addStringOption(o => o.setName('shift_id').setDescription('ID du contrat').setRequired(true))
    )
    .addSubcommand(sc =>
      sc
        .setName('close')
        .setDescription('Fermer un contrat (admins)')
        .addStringOption(o => o.setName('shift_id').setDescription('ID du contrat').setRequired(true))
    )
    .addSubcommand(sc =>
      sc
        .setName('my')
        .setDescription('Voir les contrats que tu gères avec filtres')
        .addStringOption(o =>
          o
            .setName('status')
            .setDescription('Filtrer par statut')
            .setRequired(false)
            .addChoices(
              { name: 'Tous', value: 'all' },
              { name: 'Assignés', value: 'assigned' },
              { name: 'Non assignés', value: 'unassigned' },
              { name: 'Ouverts', value: 'open' },
              { name: 'Fermés', value: 'closed' }
            )
        )
        .addIntegerOption(o =>
          o
            .setName('year')
            .setDescription('Année de publication (ex: 2026)')
            .setRequired(false)
            .setMinValue(2024)
            .setMaxValue(2100)
        )
        .addStringOption(o =>
          o.setName('subject').setDescription('Filtrer par matière').setRequired(false)
        )
        .addStringOption(o =>
          o.setName('published_after').setDescription('Publié à partir de YYYY-MM-DD').setRequired(false)
        )
        .addStringOption(o =>
          o.setName('published_before').setDescription('Publié jusqu’à YYYY-MM-DD').setRequired(false)
        )
        .addIntegerOption(o =>
          o
            .setName('limit')
            .setDescription('Nombre max de résultats (1-50)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .toJSON(),
];

/**
 * Handle /shift command
 */
async function handleShiftCommand(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'shift') {
    return false;
  }

  const sub = interaction.options.getSubcommand();

  // Admin-only for ALL shift commands
  if (!isAdmin(interaction.member)) {
    await interaction.reply({ 
      content: '❌ Toutes les commandes /shift sont réservées aux administrateurs.', 
      flags: [MessageFlags.Ephemeral] 
    });
    return true;
  }

  // /shift post
  if (sub === 'post') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const result = await shiftActions.postShift(interaction.guild, interaction.user.id, {
      title: interaction.options.getString('title'),
      startDate: interaction.options.getString('start_date'),
      durationHours: interaction.options.getNumber('duration_hours'),
      availabilities: interaction.options.getString('availabilities'),
      description: interaction.options.getString('description'),
      subjects: (interaction.options.getString('subjects') || '').split(',').map(s => s.trim()).filter(Boolean),
      ...(interaction.options.getString('shift_id') ? { shiftId: interaction.options.getString('shift_id') } : {}),
    });
    await interaction.editReply({ content: `✅ Contrat publié : **${result.title}**\nID: \`${result.shiftId}\`` });
    return true;
  }

  // /shift applicants
  if (sub === 'applicants') {
    const shiftId = interaction.options.getString('shift_id');
    const filterRole = interaction.options.getString('filter_role') || undefined;
    
    const apps = await listApplicants(interaction.guildId, shiftId, filterRole);
    
    if (!apps.length) {
      await interaction.reply({ 
        content: '❌ Aucun candidat pour ce contrat.', 
        flags: [MessageFlags.Ephemeral] 
      });
      return true;
    }

    const lines = apps.map(
      a => `• <@${a.userId}> — **${a.roleSnapshot || 'n/a'}** — Postulé: <t:${Math.floor(a.appliedAt / 1000)}:R>`
    );

    await interaction.reply({
      content: `**📋 Candidats pour ${shiftId}:**\n\n${lines.join('\n')}`,
      flags: [MessageFlags.Ephemeral],
    });
    return true;
  }

  // /shift assign
  if (sub === 'assign') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const result = await shiftActions.assignShift(interaction.guild, interaction.user.id,
      interaction.options.getString('shift_id'), interaction.options.getUser('user').id,
      { selectionReason: interaction.options.getString('reason') || undefined });
    await interaction.editReply({ content: `✅ Contrat assigné à <@${result.userId}>. Fil privé : <#${result.threadId}>` });
    return true;
  }

  // /shift unassign
  if (sub === 'unassign') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const result = await shiftActions.unassignShift(interaction.guild, interaction.options.getString('shift_id'));
    await interaction.editReply({ content: `✅ Attribution retirée. Le contrat \`${result.shiftId}\` est réouvert.` });
    return true;
  }

  // /shift close
  if (sub === 'close') {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const result = await shiftActions.closeShift(interaction.guild, interaction.options.getString('shift_id'));
    await interaction.editReply({ content: `✅ Contrat \`${result.shiftId}\` fermé aux candidatures.` });
    return true;
  }

  // /shift my - Show contracts created by this admin with filters
  if (sub === 'my') {
    const statusFilter = interaction.options.getString('status') || 'all';
    const yearFilter = interaction.options.getInteger('year');
    const subjectFilter = (interaction.options.getString('subject') || '').trim().toLowerCase();
    const publishedAfterInput = interaction.options.getString('published_after');
    const publishedBeforeInput = interaction.options.getString('published_before');
    const limit = interaction.options.getInteger('limit') || 10;

    const publishedAfter = parseDateInput(publishedAfterInput, false);
    const publishedBefore = parseDateInput(publishedBeforeInput, true);

    if (publishedAfterInput && !publishedAfter) {
      return interaction.reply({
        content: '❌ Le filtre `published_after` doit être au format `YYYY-MM-DD`.',
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (publishedBeforeInput && !publishedBefore) {
      return interaction.reply({
        content: '❌ Le filtre `published_before` doit être au format `YYYY-MM-DD`.',
        flags: [MessageFlags.Ephemeral],
      });
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const [shifts, assignments] = await Promise.all([
      listShiftsByCreator(interaction.guildId, interaction.user.id),
      listActiveAssignments(interaction.guildId),
    ]);

    if (!shifts.length) {
      return interaction.editReply('📭 Tu n’as publié aucun contrat pour le moment.');
    }

    const assignmentMap = new Map(assignments.map((assignment) => [assignment.shiftId, assignment]));

    const rows = shifts
      .map((shift) => {
        const assignment = assignmentMap.get(shift.shiftId);
        const subjects = Array.isArray(shift.subjects) ? shift.subjects : [];
        const createdAt = shift.createdAt || null;
        const isAssigned = Boolean(assignment);
        const displayStatus = isAssigned ? 'assigné' : shift.status === 'closed' ? 'fermé' : 'ouvert';

        return {
          ...shift,
          subjects,
          createdAt,
          assignment,
          isAssigned,
          displayStatus,
        };
      })
      .filter((row) => {
        if (statusFilter === 'assigned' && !row.isAssigned) return false;
        if (statusFilter === 'unassigned' && row.isAssigned) return false;
        if (statusFilter === 'open' && row.status !== 'open') return false;
        if (statusFilter === 'closed' && row.status !== 'closed') return false;

        if (yearFilter && row.createdAt) {
          const createdYear = new Date(row.createdAt).getUTCFullYear();
          if (createdYear !== yearFilter) return false;
        }

        if (subjectFilter) {
          const haystack = row.subjects.join(', ').toLowerCase();
          if (!haystack.includes(subjectFilter)) return false;
        }

        if (publishedAfter && row.createdAt && row.createdAt < publishedAfter) return false;
        if (publishedBefore && row.createdAt && row.createdAt > publishedBefore) return false;

        return true;
      })
      .sort((a, b) => {
        const aTs = a.assignment?.assignedAt || a.createdAt || 0;
        const bTs = b.assignment?.assignedAt || b.createdAt || 0;
        return bTs - aTs;
      });

    if (!rows.length) {
      return interaction.editReply('📭 Aucun contrat ne correspond aux filtres demandés.');
    }

    const visibleRows = rows.slice(0, limit);
    const lines = visibleRows.map((row) => {
      const published = formatDiscordTime(row.createdAt);
      const subjects = row.subjects.length ? row.subjects.join(', ') : 'Matière non précisée';
      const assignmentLine = row.assignment
        ? `\n  Assigné à <@${row.assignment.userId}> le ${formatDiscordTime(row.assignment.assignedAt)}`
        : '\n  Non assigné pour le moment';

      return (
        `• **${row.title || `Shift ${row.shiftId}`}** \`${row.shiftId}\`` +
        `\n  Statut : **${row.displayStatus}**` +
        `\n  Matières : ${subjects}` +
        `\n  Publié : ${published}` +
        assignmentLine
      );
    });

    const appliedFilters = [
      `statut=${statusFilter}`,
      yearFilter ? `année=${yearFilter}` : null,
      subjectFilter ? `matière=${subjectFilter}` : null,
      publishedAfterInput ? `publié_après=${publishedAfterInput}` : null,
      publishedBeforeInput ? `publié_avant=${publishedBeforeInput}` : null,
      `limite=${limit}`,
    ].filter(Boolean);

    const header =
      `**📋 Contrats que tu gères** (${visibleRows.length}/${rows.length})\n` +
      `Filtres : ${appliedFilters.join(' • ')}\n\n`;

    const safeLines = [];
    let contentLength = header.length;
    for (const line of lines) {
      const nextLength = contentLength + line.length + (safeLines.length ? 2 : 0);
      if (nextLength > 1850) break;
      safeLines.push(line);
      contentLength = nextLength;
    }

    const truncatedNote =
      safeLines.length < visibleRows.length
        ? `\n\n… ${visibleRows.length - safeLines.length} résultat(s) masqué(s) pour tenir dans un seul message. Réduis \`limit\` ou affine les filtres.`
        : '';

    await interaction.editReply(header + safeLines.join('\n\n') + truncatedNote);
    return true;
  }

  return false;
}

/**
 * Handle shift buttons (Apply/Withdraw)
 */
async function handleShiftButton(interaction) {
  if (!interaction.isButton()) return false;
  const match = /^shift_(apply|withdraw)_(.+)$/.exec(interaction.customId);
  if (!match) return false;
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  try {
    const { AutomationService } = require('./automation/service');
    const service = new AutomationService(interaction.client);
    await service.application(interaction.guild, match[2], interaction.user.id, match[1] === 'withdraw');
    await interaction.editReply({ content: match[1] === 'apply' ? '✅ Ta candidature a été envoyée !' : '↩️ Ta candidature a été retirée.' });
  } catch (error) {
    console.error('Shift button failed:', error.code || error.name);
    await interaction.editReply({ content: error.status ? `❌ ${error.message}` : '❌ Action interrompue. Contacter le Centre Reed avant de recommencer.' });
  }
  return true;
}

async function handleShiftChatCommand(interaction) {
  try { return await handleShiftCommand(interaction); }
  catch (error) {
    console.error('Shift command failed:', error.code || error.name);
    const payload = { content: error.status ? `❌ ${error.message}` : '❌ Action interrompue. Vérifier le mandat avant de recommencer.' };
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
    else await interaction.reply({ ...payload, flags: [MessageFlags.Ephemeral] });
    return true;
  }
}

module.exports = {
  shiftCommands,
  handleShiftChatCommand,
  handleShiftButton,
};


