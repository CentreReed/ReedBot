const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config');
const { shiftCommands } = require('./shiftModule');

const commands = [
  new SlashCommandBuilder()
    .setName('start_onboarding')
    .setDescription('Démarrer la Formation Niveau 1 (Outils & Appariement)')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('finish_onboarding')
    .setDescription('Formation Séances (Découverte & Récurrentes) - Requiert rôle Apparié')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('complete_training')
    .setDescription('Formation Niveau 2 (Méthode Centre Reed) - Requiert rôle Apparié')
    .toJSON(),
  ...shiftCommands,
];

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log('🔄 Registering slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );

    console.log('✅ Slash command registered successfully!');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
})();

