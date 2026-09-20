import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ChannelSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ComponentType,
    ChannelType,
    EmbedBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { getColor } from '../../config/bot.js';

const MAX_FIELDS = 25;
const IDLE_TIMEOUT = 900_000; 

const COLOR_PRESETS = [
    { label: 'Primary (Blue)',       value: '#336699' },
    { label: 'Success (Green)',      value: '#57F287' },
    { label: 'Error (Red)',          value: '#ED4245' },
    { label: 'Warning (Yellow)',     value: '#FEE75C' },
    { label: 'Info (Bright Blue)',   value: '#3498DB' },
    { label: 'Blurple (Discord)',    value: '#5865F2' },
    { label: 'Fuchsia',              value: '#EB459E' },
    { label: 'Gold',                 value: '#F1C40F' },
    { label: 'White',                value: '#FFFFFF' },
    { label: 'Dark',                 value: '#202225' },
    { label: 'Custom Hex...',        value: '__custom__' },
];

function isValidUrl(str) {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function isValidHex(str) {
    return /^#[0-9A-Fa-f]{6}$/.test(str);
}

function resolveEmbedColor(value) {
    try {
        const resolved = getColor(value || 'primary');
        if (typeof resolved === 'number' && Number.isFinite(resolved) && resolved >= 0 && resolved <= 0xffffff) {
            return resolved;
        }
    } catch {
        // ignore invalid value and fall through to primary
    }
    return getColor('primary');
}

function buildPreviewEmbed(state) {
    const embed = new EmbedBuilder();

    if (state.title)       embed.setTitle(state.title.substring(0, 256));
    if (state.description) embed.setDescription(state.description.substring(0, 4096));

    embed.setColor(resolveEmbedColor(state.color));

    if (state.author?.name) {
        const obj = { name: state.author.name.substring(0, 256) };
        if (state.author.iconUrl && isValidUrl(state.author.iconUrl)) obj.iconURL = state.author.iconUrl;
        if (state.author.url   && isValidUrl(state.author.url))      obj.url     = state.author.url;
        embed.setAuthor(obj);
    }

    if (state.footer?.text) {
        const obj = { text: state.footer.text.substring(0, 2048) };
        if (state.footer.iconUrl && isValidUrl(state.footer.iconUrl)) obj.iconURL = state.footer.iconUrl;
        embed.setFooter(obj);
    }

    if (state.thumbnail && isValidUrl(state.thumbnail)) embed.setThumbnail(state.thumbnail);
    if (state.image     && isValidUrl(state.image))     embed.setImage(state.image);
    if (state.timestamp) embed.setTimestamp();

    if (state.fields.length > 0) embed.addFields(state.fields.slice(0, 25));

    if (
        !state.title &&
        !state.description &&
        state.fields.length === 0 &&
        !state.author?.name
    ) {
        embed.setDescription('*(Empty — use the menu below to add content)*');
    }

    return embed;
}

function buildDashboardEmbed(state) {
    const trunc = (str, n) =>
        str.length > n ? str.substring(0, n) + '…' : str;

    const lines = [
        `**Title** › ${state.title ? `\`${trunc(state.title, 40)}\`` : '`Not set`'}`,
        `**Description** › ${state.description ? `${state.description.length} character(s)` : '`Not set`'}`,
        `**Color** › ${state.color ? `\`${state.color}\`` : '`Default`'}`,
        `**Author** › ${state.author?.name ? `\`${trunc(state.author.name, 30)}\`` : '`Not set`'}`,
        `**Footer** › ${state.footer?.text ? `\`${trunc(state.footer.text, 30)}\`` : '`Not set`'}`,
        `**Thumbnail** › ${state.thumbnail ? '✅ Set' : '`Not set`'}`,
        `**Image** › ${state.image ? '✅ Set' : '`Not set`'}`,
        `**Timestamp** › ${state.timestamp ? '✅ Enabled' : '`Disabled`'}`,
        `**Fields** › ${state.fields.length} / ${MAX_FIELDS}`,
    ];

    return new EmbedBuilder()
        .setTitle('Embed Builder — Control Panel')
        .setDescription(lines.join('\n'))
        .setColor(getColor('info'))
        .setFooter({ text: 'The preview above updates live · Closes after 15 min of inactivity' });
}

function buildMainMenu(state) {
    const primaryRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('eb_main_edit_content')
            .setLabel('Edit Content')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),
        new ButtonBuilder()
            .setCustomId('eb_main_set_color')
            .setLabel('Set Color')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🎨'),
        new ButtonBuilder()
            .setCustomId('eb_main_set_images')
            .setLabel('Set Images')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🖼️'),
        new ButtonBuilder()
            .setCustomId('eb_main_post_embed')
            .setLabel('Post Embed')
            .setStyle(ButtonStyle.Success)
            .setEmoji('📤'),
    );

    const secondaryRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('eb_main_add_field')
            .setLabel(`Add Field (${state.fields.length}/${MAX_FIELDS})`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('➕'),
        new ButtonBuilder()
            .setCustomId('eb_main_edit_field')
            .setLabel('Edit Field')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📝')
            .setDisabled(state.fields.length === 0),
        new ButtonBuilder()
            .setCustomId('eb_main_remove_field')
            .setLabel('Remove Field')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('➖')
            .setDisabled(state.fields.length === 0),
        new ButtonBuilder()
            .setCustomId('eb_main_toggle_timestamp')
            .setLabel(state.timestamp ? 'Disable Timestamp' : 'Enable Timestamp')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🕐'),
    );

    const tertiaryRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('eb_main_reorder_fields')
            .setLabel('Reorder Fields')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↕️')
            .setDisabled(state.fields.length < 2),
        new ButtonBuilder()
            .setCustomId('eb_main_reset_all')
            .setLabel('Reset Everything')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
    );

    return [primaryRow, secondaryRow, tertiaryRow];
}

async function refreshDashboard(interaction, state) {
    return await InteractionHelper.safeEditReply(interaction, {
        embeds: [buildPreviewEmbed(state), buildDashboardEmbed(state)],
        components: buildMainMenu(state),
    });
}

async function handleEditContent(selectInteraction, rootInteraction, state) {
    const modal = new ModalBuilder()
        .setCustomId('eb_content')
        .setTitle('Edit Content')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('eb_title')
                    .setLabel('Title (max 256 characters)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(state.title || '')
                    .setMaxLength(256)
                    .setRequired(false)
                    .setPlaceholder('My Embed Title'),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('eb_description')
                    .setLabel('Description (max 4000 characters)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(state.description ? state.description.substring(0, 4000) : '')
                    .setMaxLength(4000)
                    .setRequired(false)
                    .setPlaceholder('Write your embed description here...'),
            ),
        );

    const shown = await InteractionHelper.safeShowModal(selectInteraction, modal);
    if (!shown) return;

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'eb_content' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    await submitted.deferUpdate().catch(() => {});

    state.title       = submitted.fields.getTextInputValue('eb_title').trim()       || null;
    state.description = submitted.fields.getTextInputValue('eb_description').trim() || null;

    await refreshDashboard(rootInteraction, state);
}

async function handleSetColor(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate().catch(() => {});

    const colorSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_color_pick')
        .setPlaceholder('Choose a color...')
        .addOptions(
            COLOR_PRESETS.map(c =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(c.label)
                    .setValue(c.value)
                    .setDescription(c.value !== '__custom__' ? c.value : 'Enter your own #RRGGBB value'),
            ),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Set Color')
                .setDescription('Select a preset color or choose **Custom Hex** to enter your own `#RRGGBB` value.')
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(colorSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const colorCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'eb_color_pick',
        time: 60_000,
        max: 1,
    });

    colorCollector.on('collect', async colorInter => {
        try {
            const picked = colorInter.values[0];

            if (picked === '__custom__') {
                const hexModal = new ModalBuilder()
                    .setCustomId('eb_custom_hex')
                    .setTitle('Custom Color')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('hex_value')
                                .setLabel('Hex Color Code')
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('#5865F2')
                                .setMaxLength(7)
                                .setMinLength(7)
                                .setRequired(true),
                        ),
                    );

                const shown = await InteractionHelper.safeShowModal(colorInter, hexModal);
                if (!shown) return;

                const hexSubmit = await colorInter
                    .awaitModalSubmit({
                        filter: i => i.customId === 'eb_custom_hex' && i.user.id === colorInter.user.id,
                        time: 60_000,
                    })
                    .catch(() => null);

                if (!hexSubmit) return;

                const hex = hexSubmit.fields.getTextInputValue('hex_value').trim();
                if (!isValidHex(hex)) {
                    await replyUserError(hexSubmit, {
                        type: ErrorTypes.USER_INPUT,
                        message: `\`${hex}\` is not a valid hex color. Use the format \`#RRGGBB\` (e.g. \`#5865F2\`).`,
                    });
                    return;
                }

                state.color = hex;
                await hexSubmit.deferUpdate().catch(() => {});
            } else {
                state.color = picked;
                await colorInter.deferUpdate().catch(() => {});
            }

            await refreshDashboard(rootInteraction, state);
        } catch (error) {
            logger.warn('Embed builder color picker interaction failed:', error.message);
        }
    });
}

async function handleSetImages(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate().catch(() => {});

    const imageSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_image_pick')
        .setPlaceholder('What would you like to change?')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Set Thumbnail')
                .setDescription('Small image displayed in the top-right corner')
                .setValue('set_thumbnail')
                .setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Set Large Image')
                .setDescription('Full-width banner image at the bottom')
                .setValue('set_image')
                .setEmoji('📸'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Clear Thumbnail')
                .setDescription('Remove the current thumbnail')
                .setValue('clear_thumbnail')
                .setEmoji('🗑️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Clear Large Image')
                .setDescription('Remove the current large image')
                .setValue('clear_image')
                .setEmoji('🗑️'),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Set Images')
                .setDescription('Choose which image to set or remove.')
                .addFields(
                    { name: 'Thumbnail',   value: state.thumbnail ? `[View](${state.thumbnail})` : '`Not set`', inline: true },
                    { name: 'Large Image', value: state.image     ? `[View](${state.image})`     : '`Not set`', inline: true },
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(imageSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const imgMenuCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'eb_image_pick',
        time: 60_000,
        max: 1,
    });

    imgMenuCollector.on('collect', async imgInter => {
        try {
            const pick = imgInter.values[0];

            if (pick === 'clear_thumbnail') {
                state.thumbnail = null;
                await imgInter.deferUpdate();
                await refreshDashboard(rootInteraction, state);
                return;
            }
            if (pick === 'clear_image') {
                state.image = null;
                await imgInter.deferUpdate();
                await refreshDashboard(rootInteraction, state);
                return;
            }

            const isThumb = pick === 'set_thumbnail';

            const urlModal = new ModalBuilder()
                .setCustomId('eb_image_url')
                .setTitle(isThumb ? 'Set Thumbnail' : 'Set Large Image')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('image_url')
                            .setLabel('Image URL')
                            .setStyle(TextInputStyle.Short)
                            .setValue(isThumb ? (state.thumbnail || '') : (state.image || ''))
                            .setRequired(true)
                            .setPlaceholder('https://example.com/image.png'),
                    ),
                );

            const shown = await InteractionHelper.safeShowModal(imgInter, urlModal);
            if (!shown) return;

            const submitted = await imgInter
                .awaitModalSubmit({
                    filter: i => i.customId === 'eb_image_url' && i.user.id === imgInter.user.id,
                    time: 60_000,
                })
                .catch(() => null);

            if (!submitted) return;

            const url = submitted.fields.getTextInputValue('image_url').trim();
            if (!isValidUrl(url)) {
                await replyUserError(submitted, {
                    type: ErrorTypes.USER_INPUT,
                    message: 'Image URL must be a valid `https://` link to a publicly accessible image.',
                });
                return;
            }

            if (isThumb) state.thumbnail = url;
            else         state.image     = url;

            await submitted.deferUpdate().catch(() => {});
            await refreshDashboard(rootInteraction, state);
        } catch (error) {
            logger.warn('Embed builder image picker interaction failed:', error.message);
        }
    });
}

async function handleAddField(selectInteraction, rootInteraction, state) {
    if (state.fields.length >= MAX_FIELDS) {
        await selectInteraction.deferUpdate();
        await replyUserError(selectInteraction, {
            type: ErrorTypes.VALIDATION,
            message: `Embeds can have a maximum of ${MAX_FIELDS} fields.`,
        });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('eb_add_field')
        .setTitle('Add Field')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('field_name')
                    .setLabel('Field Name')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(256)
                    .setRequired(true)
                    .setPlaceholder('Field Title')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('field_value')
                    .setLabel('Field Value')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(1024)
                    .setRequired(true)
                    .setPlaceholder('Field content goes here...')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('field_inline')
                    .setLabel('Display Inline? (yes/no)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setPlaceholder('yes or no')
            )
        );

    const shown = await InteractionHelper.safeShowModal(selectInteraction, modal);
    if (!shown) return;

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'eb_add_field' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const name = submitted.fields.getTextInputValue('field_name').trim();
    const value = submitted.fields.getTextInputValue('field_value').trim();
    const inlineInput = submitted.fields.getTextInputValue('field_inline').trim().toLowerCase();
    const inline = inlineInput === 'yes' || inlineInput === 'true';

    state.fields.push({ name, value, inline });

    await submitted.deferUpdate().catch(() => {});
    await refreshDashboard(rootInteraction, state);
}

async function handleEditField(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate();

    const pickSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_edit_field_pick')
        .setPlaceholder('Select a field to edit...')
        .addOptions(
            state.fields.slice(0, 25).map((f, i) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${i + 1}. ${f.name.substring(0, 50)}`)
                    .setDescription(`${f.value.substring(0, 80)}${f.value.length > 80 ? '…' : ''} · ${f.inline ? 'Inline' : 'Block'}`)
                    .setValue(String(i))
                    .setEmoji('📝'),
            ),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Edit Field')
                .setDescription('Select the field you want to modify.')
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(pickSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const pickCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'eb_edit_field_pick',
        time: 60_000,
        max: 1,
    });

    pickCollector.on('collect', async pickInter => {
        try {
            const idx = parseInt(pickInter.values[0], 10);
            const field = state.fields[idx];
            if (!field) { await pickInter.deferUpdate(); return; }

            const modal = new ModalBuilder()
                .setCustomId('eb_edit_field_modal')
                .setTitle(`Edit Field ${idx + 1}`)
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('field_name')
                            .setLabel('Field Name')
                            .setStyle(TextInputStyle.Short)
                            .setValue(field.name)
                            .setMaxLength(256)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('field_value')
                            .setLabel('Field Value')
                            .setStyle(TextInputStyle.Paragraph)
                            .setValue(field.value.substring(0, 1024))
                            .setMaxLength(1024)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('field_inline')
                            .setLabel('Display Inline? (yes/no)')
                            .setStyle(TextInputStyle.Short)
                            .setValue(field.inline ? 'yes' : 'no')
                            .setRequired(false)
                    )
                );

            const shown = await InteractionHelper.safeShowModal(pickInter, modal);
            if (!shown) return;

            const submitted = await pickInter
                .awaitModalSubmit({
                    filter: i => i.customId === 'eb_edit_field_modal' && i.user.id === pickInter.user.id,
                    time: 120_000,
                })
                .catch(() => null);

            if (!submitted) return;

            const name = submitted.fields.getTextInputValue('field_name').trim();
            const value = submitted.fields.getTextInputValue('field_value').trim();
            const inlineInput = submitted.fields.getTextInputValue('field_inline').trim().toLowerCase();
            const inline = inlineInput === 'yes' || inlineInput === 'true';

            state.fields[idx] = { name, value, inline };

            await submitted.deferUpdate().catch(() => {});
            await refreshDashboard(rootInteraction, state);
        } catch (error) {
            logger.warn('Embed builder field edit interaction failed:', error.message);
        }
    });
}

async function handleRemoveField(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate();

    const pickSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_remove_field_pick')
        .setPlaceholder('Select a field to remove...')
        .addOptions(
            state.fields.slice(0, 25).map((f, i) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${i + 1}. ${f.name.substring(0, 50)}`)
                    .setDescription(`${f.value.substring(0, 90)}${f.value.length > 90 ? '…' : ''}`)
                    .setValue(String(i))
                    .setEmoji('➖'),
            ),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Remove Field')
                .setDescription('Select the field you want to delete.')
                .setColor(getColor('warning')),
        ],
        components: [new ActionRowBuilder().addComponents(pickSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const removeCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'eb_remove_field_pick',
        time: 60_000,
        max: 1,
    });

    removeCollector.on('collect', async removeInter => {
        await removeInter.deferUpdate();
        const idx = parseInt(removeInter.values[0], 10);
        state.fields.splice(idx, 1);
        await refreshDashboard(rootInteraction, state);
    });
}

async function handlePostEmbed(selectInteraction, state) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('eb_channel_pick')
        .setPlaceholder('Select a channel to send this embed...')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Select Destination Channel')
                .setDescription('Choose where you want to publish this embed message.')
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const channelCollector = selectInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'eb_channel_pick',
        time: 60_000,
        max: 1,
    });

    channelCollector.on('collect', async channelInter => {
        try {
            await channelInter.deferUpdate();
            const channelId = channelInter.values[0];
            const channel = await selectInteraction.guild.channels.fetch(channelId).catch(() => null);

            if (!channel) {
                await replyUserError(channelInter, {
                    type: ErrorTypes.NOT_FOUND,
                    message: 'Could not access the selected channel.',
                });
                return;
            }

            const embedToPost = buildPreviewEmbed(state);
            await channel.send({ embeds: [embedToPost] });

            await channelInter.followUp({
                embeds: [
                    successEmbed(
                        'Embed Sent!',
                        `Your embed has been successfully published to ${channel}.`
                    )
                ],
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            logger.error('Failed to send embed:', error);
            await replyUserError(channelInter, {
                type: ErrorTypes.EXECUTION,
                message: 'Failed to send the embed. Ensure the bot has permission to send messages in that channel.',
            });
        }
    });
}

export const data = new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Build and customize an embed message step-by-step')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
    const state = {
        title: null,
        description: null,
        color: null,
        author: null,
        footer: null,
        thumbnail: null,
        image: null,
        timestamp: false,
        fields: [],
    };

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const message = await refreshDashboard(interaction, state);

    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: IDLE_TIMEOUT,
    });

    collector.on('collect', async btnInter => {
        try {
            switch (btnInter.customId) {
                case 'eb_main_edit_content':
                    await handleEditContent(btnInter, interaction, state);
                    break;
                case 'eb_main_set_color':
                    await handleSetColor(btnInter, interaction, state);
                    break;
                case 'eb_main_set_images':
                    await handleSetImages(btnInter, interaction, state);
                    break;
                case 'eb_main_add_field':
                    await handleAddField(btnInter, interaction, state);
                    break;
                case 'eb_main_edit_field':
                    await handleEditField(btnInter, interaction, state);
                    break;
                case 'eb_main_remove_field':
                    await handleRemoveField(btnInter, interaction, state);
                    break;
                case 'eb_main_toggle_timestamp':
                    state.timestamp = !state.timestamp;
                    await btnInter.deferUpdate();
                    await refreshDashboard(interaction, state);
                    break;
                case 'eb_main_reset_all':
                    state.title = null;
                    state.description = null;
                    state.color = null;
                    state.author = null;
                    state.footer = null;
                    state.thumbnail = null;
                    state.image = null;
                    state.timestamp = false;
                    state.fields = [];
                    await btnInter.deferUpdate();
                    await refreshDashboard(interaction, state);
                    break;
                case 'eb_main_post_embed':
                    await handlePostEmbed(btnInter, state);
                    break;
            }
        } catch (err) {
            logger.error('Embed Builder collector error:', err);
        }
    });

    collector.on('end', () => {
        InteractionHelper.safeEditReply(interaction, {
            components: [],
        }).catch(() => {});
    });
}
