import { Bot, Context, InlineKeyboard, webhookCallback } from "grammy";
import { searchPlaces, type GeocodeResult } from "@/lib/geocoding";
import { createVisitFromGeocode, deleteVisit } from "@/lib/visits";
import { isOwnerTelegramUser } from "@/lib/auth";
import type { Achievement } from "@/lib/achievements";

interface UserSession {
  places: GeocodeResult[];
  query: string;
  autoAddedVisitId?: string;
}

const sessions = new Map<number, UserSession>();

function getBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }
  return new Bot(token);
}

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

function formatPlaceLine(place: GeocodeResult, index?: number): string {
  const prefix = index !== undefined ? `${index + 1}. ` : "";
  const region = place.region ? ` · ${place.region}` : "";
  return `${prefix}<b>${place.city}</b>, ${place.country}${region}`;
}

async function getAchievementUnlockText(
  before: Achievement[],
  isNew: boolean
): Promise<string> {
  if (!isNew) return "";

  const { getAllVisits } = await import("@/lib/visits");
  const {
    computeAchievements,
    getNewlyUnlockedAchievements,
    formatAchievementUnlockMessage,
  } = await import("@/lib/achievements");

  const visits = await getAllVisits();
  const achievementsAfter = computeAchievements(visits);
  const newlyUnlocked = getNewlyUnlockedAchievements(before, achievementsAfter);

  return formatAchievementUnlockMessage(newlyUnlocked);
}

async function buildVisitAddedMessage(
  place: GeocodeResult,
  isNew: boolean,
  alternativesCount: number,
  achievementsBefore: Achievement[]
): Promise<string> {
  const statusLine = isNew
    ? "✅ Додано на карту!"
    : "ℹ️ Вже було на карті — оновив відмітку.";

  const alternativesHint =
    alternativesCount > 0
      ? `\n\n<i>Є ще ${alternativesCount} варіант(и) — «Обрати інше»</i>`
      : "";

  const achievementText = await getAchievementUnlockText(achievementsBefore, isNew);

  return `${statusLine}\n\n${formatPlaceLine(place)}${alternativesHint}${achievementText}`;
}

function buildAddedKeyboard(visitId: string | null, hasAlternatives: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (visitId) {
    keyboard.text("↩️ Скасувати", `undo:${visitId}`);
  }
  if (hasAlternatives) {
    keyboard.text("📋 Обрати інше", "choose");
  }
  keyboard.row().url("🗺 Відкрити карту", getSiteUrl());
  return keyboard;
}

function buildChooseKeyboard(places: GeocodeResult[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  places.forEach((place, index) => {
    keyboard.text(`${index + 1}. ${place.city}, ${place.country}`, `pick:${index}`);
    if (index < places.length - 1) keyboard.row();
  });
  keyboard.row().text("← Назад", "back");
  return keyboard;
}

async function handleStart(ctx: Context) {
  await ctx.reply(
    "Привіт! Я твоя карта подорожей.\n\n" +
      "Просто напиши місто — одразу додам на карту.\n" +
      "Не вгадав? Тисни «Скасувати» або «Обрати інше».\n\n" +
      "Команди:\n" +
      "/help — довідка\n" +
      "/stats — статистика",
    { parse_mode: "HTML" }
  );
}

async function handleHelp(ctx: Context) {
  await ctx.reply(
    "Як користуватись:\n\n" +
      "1. Напиши місто: <code>Barcelona</code> або <code>Львів</code>\n" +
      "2. Бот одразу додає найкращий варіант\n" +
      "3. Не те? — «Скасувати» або «Обрати інше»\n\n" +
      "Можна українською, англійською — як завгодно.",
    { parse_mode: "HTML" }
  );
}

async function handleStats(ctx: Context) {
  const { getAllVisits } = await import("@/lib/visits");
  const { computeStats, computeAchievements, getUnlockedCount } = await import(
    "@/lib/achievements"
  );

  const visits = await getAllVisits();
  const stats = computeStats(visits);
  const achievements = computeAchievements(visits);
  const unlocked = getUnlockedCount(achievements);

  await ctx.reply(
    `Статистика:\n\n` +
      `Місць: ${stats.totalVisits}\n` +
      `Міст: ${stats.uniqueCities}\n` +
      `Країн: ${stats.uniqueCountries}\n` +
      `Континентів: ${stats.uniqueContinents}\n\n` +
      `Ачивки: ${unlocked}/${achievements.length}`,
    { parse_mode: "HTML" }
  );
}

async function autoAddCity(ctx: Context, query: string) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const loading = await ctx.reply("Шукаю і додаю...");

  try {
    const places = await searchPlaces(query.trim(), 5);

    if (places.length === 0) {
      await ctx.api.editMessageText(
        loading.chat.id,
        loading.message_id,
        `Нічого не знайшов за «${query}».\nСпробуй інакше або додай країну: «Paris France».`
      );
      return;
    }

    const best = places[0];
    const { getAllVisits } = await import("@/lib/visits");
    const { computeAchievements } = await import("@/lib/achievements");
    const achievementsBefore = computeAchievements(await getAllVisits());

    const { visit, isNew } = await createVisitFromGeocode(best, { source: "telegram" });

    sessions.set(userId, {
      places,
      query,
      autoAddedVisitId: isNew ? visit.id : undefined,
    });

    const message = await buildVisitAddedMessage(
      best,
      isNew,
      places.length - 1,
      achievementsBefore
    );

    await ctx.api.editMessageText(
      loading.chat.id,
      loading.message_id,
      message,
      {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: buildAddedKeyboard(isNew ? visit.id : null, places.length > 1),
      }
    );
  } catch {
    await ctx.api.editMessageText(
      loading.chat.id,
      loading.message_id,
      "Помилка. Спробуй ще раз через хвилину."
    );
  }
}

async function handleUndo(ctx: Context, visitId: string) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const deleted = await deleteVisit(visitId);
  const session = sessions.get(userId);
  if (session?.autoAddedVisitId === visitId) {
    session.autoAddedVisitId = undefined;
  }

  await ctx.editMessageText(
    deleted ? "↩️ Скасовано — місце прибрано з карти." : "Не вдалося скасувати (можливо, вже видалено).",
    { reply_markup: undefined }
  );
  await ctx.answerCallbackQuery({ text: deleted ? "Скасовано" : "Помилка" });
}

async function handleChooseMenu(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = sessions.get(userId);
  if (!session || session.places.length === 0) {
    await ctx.answerCallbackQuery({ text: "Список застарів — напиши місто заново" });
    return;
  }

  const list = session.places.map((p, i) => formatPlaceLine(p, i)).join("\n");

  await ctx.editMessageText(
    `Обери варіант для «${session.query}»:\n\n${list}`,
    {
      parse_mode: "HTML",
      reply_markup: buildChooseKeyboard(session.places),
    }
  );
  await ctx.answerCallbackQuery();
}

async function handlePlacePick(ctx: Context, index: number) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = sessions.get(userId);
  if (!session?.places[index]) {
    await ctx.answerCallbackQuery({ text: "Список застарів — напиши місто заново" });
    return;
  }

  const place = session.places[index];

  if (session.autoAddedVisitId) {
    await deleteVisit(session.autoAddedVisitId);
    session.autoAddedVisitId = undefined;
  }

  try {
    const { getAllVisits } = await import("@/lib/visits");
    const { computeAchievements } = await import("@/lib/achievements");
    const achievementsBefore = computeAchievements(await getAllVisits());

    const { visit, isNew } = await createVisitFromGeocode(place, { source: "telegram" });
    session.autoAddedVisitId = isNew ? visit.id : undefined;

    const statusLine = isNew ? "✅ Замінено на:" : "ℹ️ Вже було на карті:";
    const achievementText = await getAchievementUnlockText(achievementsBefore, isNew);

    await ctx.editMessageText(
      `${statusLine}\n\n${formatPlaceLine(place)}${achievementText}`,
      {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: buildAddedKeyboard(isNew ? visit.id : null, session.places.length > 1),
      }
    );
    await ctx.answerCallbackQuery({ text: isNew ? "Оновлено!" : "Ок" });
  } catch {
    await ctx.answerCallbackQuery({ text: "Помилка збереження" });
  }
}

async function handleBack(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = sessions.get(userId);
  if (!session) {
    await ctx.answerCallbackQuery({ text: "Сесія застаріла" });
    return;
  }

  const place = session.places[0];
  const visitId = session.autoAddedVisitId ?? null;

  await ctx.editMessageText(
    `✅ На карті:\n\n${formatPlaceLine(place)}`,
    {
      parse_mode: "HTML",
      reply_markup: buildAddedKeyboard(visitId, session.places.length > 1),
    }
  );
  await ctx.answerCallbackQuery();
}

export function createBotHandlers(bot: Bot) {
  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("stats", handleStats);

  bot.callbackQuery(/^undo:(.+)$/, async (ctx) => {
    await handleUndo(ctx, ctx.match[1]);
  });

  bot.callbackQuery("choose", handleChooseMenu);

  bot.callbackQuery(/^pick:(\d+)$/, async (ctx) => {
    await handlePlacePick(ctx, parseInt(ctx.match[1], 10));
  });

  bot.callbackQuery("back", handleBack);

  bot.on("message:text", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (!isOwnerTelegramUser(userId)) {
      await ctx.reply("Цей бот тільки для власника карти.");
      return;
    }

    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;

    await autoAddCity(ctx, text);
  });
}

let botInstance: Bot | null = null;

export function getBotInstance(): Bot {
  if (!botInstance) {
    botInstance = getBot();
    createBotHandlers(botInstance);
  }
  return botInstance;
}

export function getWebhookHandler() {
  const bot = getBotInstance();
  return webhookCallback(bot, "std/http");
}
