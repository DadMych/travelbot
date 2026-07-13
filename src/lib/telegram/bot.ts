import { Bot, Context, InlineKeyboard, webhookCallback } from "grammy";
import { searchPlacesRobust, type GeocodeResult } from "@/lib/geocoding";
import { addCityFromGeocodeVerified, deleteVisit } from "@/lib/visits";
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

async function getNewlyUnlocked(
  before: Achievement[]
): Promise<Achievement[]> {
  const { getAllVisits } = await import("@/lib/visits");
  const { computeAchievements, getNewlyUnlockedAchievements } = await import(
    "@/lib/achievements"
  );

  const visits = await getAllVisits();
  const achievementsAfter = computeAchievements(visits);
  return getNewlyUnlockedAchievements(before, achievementsAfter);
}

async function notifyAchievements(ctx: Context, before: Achievement[], isNew: boolean) {
  if (!isNew || !ctx.chat) return;

  const { formatSingleAchievementMessage } = await import("@/lib/achievements");
  const newlyUnlocked = await getNewlyUnlocked(before);

  for (const achievement of newlyUnlocked) {
    await ctx.api.sendMessage(ctx.chat.id, formatSingleAchievementMessage(achievement), {
      parse_mode: "HTML",
    });
  }
}

async function addPlaceVerified(
  ctx: Context,
  place: GeocodeResult,
  achievementsBefore: Achievement[]
): Promise<{ visitId: string; isNew: boolean }> {
  const { visit, isNew } = await addCityFromGeocodeVerified(place, {
    source: "telegram",
  });

  await notifyAchievements(ctx, achievementsBefore, isNew);

  return { visitId: visit.id, isNew };
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
    const places = await searchPlacesRobust(query.trim(), 5);

    if (places.length === 0) {
      await ctx.api.editMessageText(
        loading.chat.id,
        loading.message_id,
        `❌ Не знайшов «${query}».\n\n` +
          `Спробуй з країною:\n` +
          `<code>${query}, Poland</code>\n` +
          `<code>${query}, France</code>`
      );
      return;
    }

    const best = places[0];
    const { getAllVisits } = await import("@/lib/visits");
    const { computeAchievements } = await import("@/lib/achievements");
    const achievementsBefore = computeAchievements(await getAllVisits());

    const { visitId, isNew } = await addPlaceVerified(ctx, best, achievementsBefore);

    sessions.set(userId, {
      places,
      query,
      autoAddedVisitId: isNew ? visitId : undefined,
    });

    const statusLine = isNew
      ? "✅ Додано на карту!"
      : "✅ Вже на карті (перевірено)";

    const alternativesHint =
      places.length > 1
        ? `\n\n<i>Є ще ${places.length - 1} варіант(и) — «Обрати інше»</i>`
        : "";

    await ctx.api.editMessageText(
      loading.chat.id,
      loading.message_id,
      `${statusLine}\n\n${formatPlaceLine(best)}${alternativesHint}`,
      {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: buildAddedKeyboard(isNew ? visitId : null, places.length > 1),
      }
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "невідома помилка";
    await ctx.api.editMessageText(
      loading.chat.id,
      loading.message_id,
      `❌ Не вдалося додати «${query}».\n\n${detail}\n\nСпробуй ще раз або уточни країну.`
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

    const { visitId, isNew } = await addPlaceVerified(ctx, place, achievementsBefore);
    session.autoAddedVisitId = isNew ? visitId : undefined;

    const statusLine = isNew ? "✅ Замінено на:" : "✅ Вже на карті (перевірено)";

    await ctx.editMessageText(
      `${statusLine}\n\n${formatPlaceLine(place)}`,
      {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: buildAddedKeyboard(isNew ? visitId : null, session.places.length > 1),
      }
    );
    await ctx.answerCallbackQuery({ text: isNew ? "Оновлено!" : "Ок" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Помилка";
    await ctx.answerCallbackQuery({ text: detail });
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
