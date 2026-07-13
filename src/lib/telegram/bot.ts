import { Bot, Context, InlineKeyboard, webhookCallback } from "grammy";
import { searchPlaces, type GeocodeResult } from "@/lib/geocoding";
import { createVisitFromGeocode } from "@/lib/visits";
import { isOwnerTelegramUser } from "@/lib/auth";

const pendingSearches = new Map<number, GeocodeResult[]>();

function getBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }
  return new Bot(token);
}

function formatPlaceOption(place: GeocodeResult, index: number): string {
  const typeLabel =
    place.type === "city"
      ? "город"
      : place.type === "town"
        ? "городок"
        : place.type === "village"
          ? "деревня"
          : place.type;
  const region = place.region ? ` · ${place.region}` : "";
  return `${index + 1}. ${place.city}, ${place.country}${region} (${typeLabel})`;
}

function buildPlaceKeyboard(places: GeocodeResult[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  places.forEach((place, index) => {
    keyboard.text(
      `${index + 1}. ${place.city}, ${place.country}`,
      `pick:${index}`
    );
    if (index < places.length - 1) keyboard.row();
  });
  keyboard.row().text("Отмена", "cancel");
  return keyboard;
}

async function handleStart(ctx: Context) {
  await ctx.reply(
    "Привет! Я твоя карта путешествий.\n\n" +
      "Напиши название города — покажу варианты, ты выберешь нужный, и место появится на карте.\n\n" +
      "Команды:\n" +
      "/help — справка\n" +
      "/stats — статистика",
    { parse_mode: "HTML" }
  );
}

async function handleHelp(ctx: Context) {
  await ctx.reply(
    "Как пользоваться:\n\n" +
      "1. Напиши город: <code>Барcelona</code> или <code>Tokyo</code>\n" +
      "2. Выбери из списка кнопкой\n" +
      "3. Место добавится на карту\n\n" +
      "Можно писать на русском или английском.",
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
      `Мест: ${stats.totalVisits}\n` +
      `Городов: ${stats.uniqueCities}\n` +
      `Стран: ${stats.uniqueCountries}\n` +
      `Континентов: ${stats.uniqueContinents}\n\n` +
      `Ачивки: ${unlocked}/${achievements.length}`,
    { parse_mode: "HTML" }
  );
}

async function handleCitySearch(ctx: Context, query: string) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const loading = await ctx.reply("Ищу места...");

  try {
    const places = await searchPlaces(query.trim(), 5);

    if (places.length === 0) {
      await ctx.api.editMessageText(
        loading.chat.id,
        loading.message_id,
        `Ничего не нашёл по запросу «${query}».\nПопробуй другое написание или добавь страну: «Paris France».`
      );
      return;
    }

    pendingSearches.set(userId, places);

    const list = places.map((p, i) => formatPlaceOption(p, i)).join("\n");

    await ctx.api.editMessageText(
      loading.chat.id,
      loading.message_id,
      `Нашёл ${places.length} вариант(ов) для «${query}»:\n\n${list}\n\nВыбери кнопкой:`,
      { reply_markup: buildPlaceKeyboard(places) }
    );
  } catch {
    await ctx.api.editMessageText(
      loading.chat.id,
      loading.message_id,
      "Ошибка поиска. Попробуй ещё раз через минуту."
    );
  }
}

async function handlePlacePick(ctx: Context, index: number) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const places = pendingSearches.get(userId);
  if (!places || !places[index]) {
    await ctx.answerCallbackQuery({ text: "Список устарел, напиши город заново" });
    return;
  }

  const place = places[index];
  pendingSearches.delete(userId);

  try {
    const visit = await createVisitFromGeocode(place, { source: "telegram" });
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    await ctx.editMessageText(
      `Добавлено на карту!\n\n` +
        `<b>${visit.city}</b>, ${visit.country}\n` +
        (visit.region ? `${visit.region}\n` : "") +
        `\n<a href="${siteUrl}">Открыть карту</a>`,
      { parse_mode: "HTML", link_preview_options: { is_disabled: true } }
    );
    await ctx.answerCallbackQuery({ text: "Добавлено!" });
  } catch {
    await ctx.answerCallbackQuery({ text: "Ошибка сохранения" });
  }
}

export function createBotHandlers(bot: Bot) {
  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("stats", handleStats);

  bot.callbackQuery(/^pick:(\d+)$/, async (ctx) => {
    const index = parseInt(ctx.match[1], 10);
    await handlePlacePick(ctx, index);
  });

  bot.callbackQuery("cancel", async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) pendingSearches.delete(userId);
    await ctx.editMessageText("Отменено.");
    await ctx.answerCallbackQuery();
  });

  bot.on("message:text", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (!isOwnerTelegramUser(userId)) {
      await ctx.reply("Этот бот только для владельца карты.");
      return;
    }

    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;

    await handleCitySearch(ctx, text);
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
