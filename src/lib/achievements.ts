import type { Visit } from "@/lib/db/schema";
import type { LucideIcon } from "lucide-react";
import {
  Anchor,
  Award,
  Beer,
  Binoculars,
  BookOpen,
  Camera,
  Car,
  Castle,
  Coffee,
  Compass,
  Crown,
  Flag,
  Flame,
  Footprints,
  Gem,
  Globe,
  Globe2,
  Heart,
  Landmark,
  Map,
  MapPin,
  Mountain,
  Palmtree,
  Plane,
  Rocket,
  Ship,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Tent,
  Train,
  TreePine,
  Trophy,
  Umbrella,
  Users,
  Wine,
  Zap,
} from "lucide-react";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tier: "bronze" | "silver" | "gold" | "platinum";
  progress: number;
  target: number;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface TravelStats {
  totalVisits: number;
  uniqueCities: number;
  uniqueCountries: number;
  uniqueContinents: number;
  countries: string[];
  continents: string[];
}

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

const BALKAN_COUNTRIES = new Set(["AL", "BA", "BG", "HR", "GR", "ME", "MK", "RO", "RS", "SI", "XK"]);
const NORDIC_COUNTRIES = new Set(["DK", "FI", "IS", "NO", "SE"]);
const CIS_COUNTRIES = new Set(["AM", "AZ", "BY", "GE", "KZ", "KG", "MD", "RU", "TJ", "TM", "UA", "UZ"]);
const ISLAND_NATIONS = new Set([
  "AU", "BB", "BS", "CU", "CY", "FJ", "GB", "GD", "HT", "ID", "IE", "IS",
  "JM", "JP", "LK", "MT", "MV", "NZ", "PH", "PT", "SG", "TT", "TW", "VU",
]);
const WINE_COUNTRIES = new Set(["FR", "IT", "ES", "PT", "GE", "AR", "CL", "DE", "GR", "HR"]);

interface AchievementContext {
  visits: Visit[];
  stats: TravelStats;
  europeanCountries: number;
  balkanCountries: number;
  nordicCountries: number;
  cisCountries: number;
  islandNations: number;
  wineCountries: number;
  notesCount: number;
  ratedCount: number;
  hasSouthernHemisphere: boolean;
  hasNorthernHemisphere: boolean;
  countryCodes: Set<string>;
}

type AchievementDef = Omit<Achievement, "progress" | "unlocked"> & {
  getProgress: (ctx: AchievementContext) => number;
};

function buildContext(visits: Visit[]): AchievementContext {
  const stats = computeStats(visits);
  const countryCodes = new Set(stats.countries);

  return {
    visits,
    stats,
    europeanCountries: countInSet(visits, EU_COUNTRIES),
    balkanCountries: countInSet(visits, BALKAN_COUNTRIES),
    nordicCountries: countInSet(visits, NORDIC_COUNTRIES),
    cisCountries: countInSet(visits, CIS_COUNTRIES),
    islandNations: countInSet(visits, ISLAND_NATIONS),
    wineCountries: countInSet(visits, WINE_COUNTRIES),
    notesCount: visits.filter((v) => v.notes && v.notes.length > 0).length,
    ratedCount: visits.filter((v) => v.rating && v.rating > 0).length,
    hasSouthernHemisphere: visits.some((v) => v.latitude < 0),
    hasNorthernHemisphere: visits.some((v) => v.latitude > 0),
    countryCodes,
  };
}

function countInSet(visits: Visit[], set: Set<string>): number {
  return new Set(visits.filter((v) => set.has(v.countryCode)).map((v) => v.countryCode)).size;
}

function hasCountry(ctx: AchievementContext, code: string): number {
  return ctx.countryCodes.has(code) ? 1 : 0;
}

function hasCountries(ctx: AchievementContext, codes: string[]): number {
  return codes.filter((c) => ctx.countryCodes.has(c)).length;
}

function continentCount(ctx: AchievementContext, continent: string): number {
  return ctx.stats.continents.includes(continent) ? 1 : 0;
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // Старт
  { id: "first_pin", title: "Перший пін", description: "Карта більше не пуста. Вітаємо в клубі.", icon: Footprints, tier: "bronze", target: 1, getProgress: (c) => c.stats.totalVisits },
  { id: "left_the_yard", title: "Виїхав з двору", description: "Другий пін — уже не турист у себе в голові.", icon: Car, tier: "bronze", target: 2, getProgress: (c) => c.stats.totalVisits },
  { id: "passport_worthy", title: "Загран не для галочки", description: "3 країни. Прикордонник уже тебе впізнає.", icon: Flag, tier: "bronze", target: 3, getProgress: (c) => c.stats.uniqueCountries },

  // Міста
  { id: "city_5", title: "Google Maps нервує", description: "5 міст. Навігація вже не знає, куди тебе вести.", icon: MapPin, tier: "bronze", target: 5, getProgress: (c) => c.stats.uniqueCities },
  { id: "city_10", title: "Метро? Ні, літак", description: "10 міст. Ти не турист — ти маршрут.", icon: Train, tier: "silver", target: 10, getProgress: (c) => c.stats.uniqueCities },
  { id: "city_20", title: "Digital nomad detected", description: "20 міст. Wi-Fi — твій найкращий друг.", icon: Coffee, tier: "silver", target: 20, getProgress: (c) => c.stats.uniqueCities },
  { id: "city_35", title: "Booking.com Premium Soul", description: "35 міст. Готелі тебе пам'ятають.", icon: Star, tier: "gold", target: 35, getProgress: (c) => c.stats.uniqueCities },
  { id: "city_50", title: "Мер міста (усіх)", description: "50 міст. Можеш балотуватися скрізь одразу.", icon: Crown, tier: "platinum", target: 50, getProgress: (c) => c.stats.uniqueCities },

  // Країни
  { id: "country_5", title: "Штампи не вміщаються", description: "5 країн. Паспорт товстішає.", icon: Globe, tier: "bronze", target: 5, getProgress: (c) => c.stats.uniqueCountries },
  { id: "country_10", title: "Глобус у кишені", description: "10 країн. Географія — твій flex.", icon: Globe2, tier: "silver", target: 10, getProgress: (c) => c.stats.uniqueCountries },
  { id: "country_15", title: "Митниця: «Знову ви?»", description: "15 країн. Ти вже regular customer.", icon: Award, tier: "silver", target: 15, getProgress: (c) => c.stats.uniqueCountries },
  { id: "country_25", title: "Citizen of Nowhere", description: "25 країн. Дом — там, де Wi-Fi.", icon: Rocket, tier: "gold", target: 25, getProgress: (c) => c.stats.uniqueCountries },
  { id: "country_40", title: "UN observer mode", description: "40 країн. Можеш коментувати новини з досвіду.", icon: Landmark, tier: "platinum", target: 40, getProgress: (c) => c.stats.uniqueCountries },

  // Візити
  { id: "visits_10", title: "В дорозі", description: "10 відміток. Чемодан не встигає відпочивати.", icon: Sun, tier: "bronze", target: 10, getProgress: (c) => c.stats.totalVisits },
  { id: "visits_25", title: "Nomad lite", description: "25 відміток. Офіс — це поняття відносне.", icon: Tent, tier: "silver", target: 25, getProgress: (c) => c.stats.totalVisits },
  { id: "visits_50", title: "Багаж вічності", description: "50 відміток. Рюкзак важчий за спогади.", icon: Ship, tier: "gold", target: 50, getProgress: (c) => c.stats.totalVisits },
  { id: "visits_100", title: "Легенда чек-інів", description: "100 місць. Це вже не хобі — це стиль життя.", icon: Sparkles, tier: "platinum", target: 100, getProgress: (c) => c.stats.totalVisits },

  // Континенти
  { id: "continent_2", title: "Два світи", description: "2 континенти. Земля менша, ніж здається.", icon: Compass, tier: "bronze", target: 2, getProgress: (c) => c.stats.uniqueContinents },
  { id: "continent_3", title: "Триконтинентальний", description: "3 континенти. Карта починає виглядати солідно.", icon: Map, tier: "silver", target: 3, getProgress: (c) => c.stats.uniqueContinents },
  { id: "continent_4", title: "Майже всюди", description: "4 континенти. Залишився один boss fight.", icon: Trophy, tier: "gold", target: 4, getProgress: (c) => c.stats.uniqueContinents },
  { id: "continent_5", title: "Плоска? Не сьогодні", description: "5 континентів. Земля кругла — перевірено.", icon: Gem, tier: "platinum", target: 5, getProgress: (c) => c.stats.uniqueContinents },

  // Європа
  { id: "europe_3", title: "Європа за вихідні", description: "3 європейські країни. Шенген працює на тебе.", icon: Plane, tier: "bronze", target: 3, getProgress: (c) => c.europeanCountries },
  { id: "europe_7", title: "Євротур deluxe", description: "7 країн ЄС. Євро або курс — все одно їдеш.", icon: Train, tier: "silver", target: 7, getProgress: (c) => c.europeanCountries },
  { id: "europe_12", title: "Шенгенський VIP", description: "12 європейських країн. Кордони — формальність.", icon: Award, tier: "gold", target: 12, getProgress: (c) => c.europeanCountries },

  // Регіони та вайб
  { id: "balkan_3", title: "Балканський мікс", description: "3 балканські країни. Ракія optional.", icon: Flame, tier: "silver", target: 3, getProgress: (c) => c.balkanCountries },
  { id: "nordic_2", title: "Північний вовк", description: "2 північні країни. Hygge unlocked.", icon: Snowflake, tier: "silver", target: 2, getProgress: (c) => c.nordicCountries },
  { id: "cis_3", title: "Пост-SU nostalgia", description: "3 країни колишнього СНД. «Ти звідки?» — «Звідусіль».", icon: TreePine, tier: "bronze", target: 3, getProgress: (c) => c.cisCountries },
  { id: "island_2", title: "Island hopper", description: "2 островні держави. Море — твій двір.", icon: Palmtree, tier: "silver", target: 2, getProgress: (c) => c.islandNations },
  { id: "wine_3", title: "Sommelier mode", description: "3 винні країни. «Сухе чи напівсухе?» — «Так».", icon: Wine, tier: "silver", target: 3, getProgress: (c) => c.wineCountries },

  // Континентальні боси
  { id: "asia_boss", title: "На сході все спокійно", description: "Був в Азії. Дзен досягнуто (можливо).", icon: Zap, tier: "silver", target: 1, getProgress: (c) => continentCount(c, "Asia") },
  { id: "africa_boss", title: "Сафari: pending", description: "Був в Африці. Лев не з'явився — але країна була.", icon: Binoculars, tier: "silver", target: 1, getProgress: (c) => continentCount(c, "Africa") },
  { id: "americas_boss", title: "America called", description: "Північна або Південна Америка — main character energy.", icon: Anchor, tier: "silver", target: 1, getProgress: (c) => (c.stats.continents.includes("North America") || c.stats.continents.includes("South America")) ? 1 : 0 },
  { id: "oceania_boss", title: "Кенгуру не зустрів", description: "Океанія. Хоча б не загубився.", icon: Umbrella, tier: "gold", target: 1, getProgress: (c) => continentCount(c, "Oceania") },

  // Гео-приколи
  { id: "hemispheres", title: "Півкулі зібрані", description: "Північ і Південь. GPS пишається.", icon: Globe2, tier: "gold", target: 2, getProgress: (c) => (c.hasNorthernHemisphere ? 1 : 0) + (c.hasSouthernHemisphere ? 1 : 0) },
  { id: "home_ua", title: "Батон локальний", description: "Україна на карті. Дім — це теж destination.", icon: Heart, tier: "bronze", target: 1, getProgress: (c) => hasCountry(c, "UA") },
  { id: "neighbor_pl", title: "Сусід по палаті", description: "Польща. «Dzień dobry» вже вивчив.", icon: Users, tier: "bronze", target: 1, getProgress: (c) => hasCountry(c, "PL") },
  { id: "turkey_all_inclusive", title: "All inclusive mode", description: "Туреччина. Шведський стіл memories.", icon: Beer, tier: "bronze", target: 1, getProgress: (c) => hasCountry(c, "TR") },
  { id: "pasta_wine", title: "Mamma mia", description: "Італія. Паста > все.", icon: Wine, tier: "bronze", target: 1, getProgress: (c) => hasCountry(c, "IT") },
  { id: "baguette", title: "Oui, monsieur", description: "Франція. Круасан — не просто їжа.", icon: Coffee, tier: "bronze", target: 1, getProgress: (c) => hasCountry(c, "FR") },
  { id: "big_ben", title: "Brexit не стримав", description: "Великобританія. Черга — national sport.", icon: Castle, tier: "silver", target: 1, getProgress: (c) => hasCountry(c, "GB") },
  { id: "tokyo_drift", title: "Tokyo drift (tourist edition)", description: "Японія. Контрасти max.", icon: Camera, tier: "gold", target: 1, getProgress: (c) => hasCountry(c, "JP") },
  { id: "nyc_energy", title: "NYC energy", description: "США. Everything is bigger.", icon: Rocket, tier: "silver", target: 1, getProgress: (c) => hasCountry(c, "US") },

  // Кластери
  { id: "benelux", title: "Benelux speedrun", description: "Бельгія + Нідерланди + Люксембург. Міні-Європа за день.", icon: Zap, tier: "gold", target: 3, getProgress: (c) => hasCountries(c, ["BE", "NL", "LU"]) },
  { id: "baltic_tour", title: "Балтійський трио", description: "Естонія, Латвія, Литва — nordic-lite пакет.", icon: Snowflake, tier: "gold", target: 3, getProgress: (c) => hasCountries(c, ["EE", "LV", "LT"]) },
  { id: "iberia", title: "Іберійський дует", description: "Іспанія + Португалія. Сiesta approved.", icon: Sun, tier: "silver", target: 2, getProgress: (c) => hasCountries(c, ["ES", "PT"]) },

  // Контент
  { id: "notes_3", title: "Мовчазний тип? Ні", description: "3 місця з нотатками. Історії важливі.", icon: BookOpen, tier: "bronze", target: 3, getProgress: (c) => c.notesCount },
  { id: "notes_10", title: "Мемуарист", description: "10 нотаток. Твій travel blog без Instagram.", icon: BookOpen, tier: "silver", target: 10, getProgress: (c) => c.notesCount },
  { id: "rated_5", title: "Критик TripAdvisor", description: "5 оцінок. Зірки — серйозно.", icon: Star, tier: "bronze", target: 5, getProgress: (c) => c.ratedCount },

  // Спеціальні
  { id: "mountain_vibes", title: "На висоті", description: "Гірський регіон. Повітря рідке, види — ні.", icon: Mountain, tier: "bronze", target: 1, getProgress: (c) => c.visits.filter((v) => /mount|alps|carpath|pyrene|rocky|гор|альп/i.test(`${v.region} ${v.city} ${v.notes ?? ""}`)).length > 0 ? 1 : 0 },
  { id: "capital_collector", title: "Столичний збирач", description: "5 столиць (міста з capital у типі або відомі столиці).", icon: Landmark, tier: "gold", target: 5, getProgress: (c) => countCapitals(c.visits) },
];

const KNOWN_CAPITALS = new Set([
  "Kyiv", "Kiev", "Київ", "Warsaw", "Warszawa", "Berlin", "Paris", "London",
  "Rome", "Roma", "Madrid", "Lisbon", "Lisboa", "Vienna", "Wien", "Prague",
  "Praha", "Budapest", "Bucharest", "Sofia", "Athens", "Athina", "Amsterdam",
  "Brussels", "Bruxelles", "Copenhagen", "Stockholm", "Oslo", "Helsinki",
  "Dublin", "Tokyo", "Seoul", "Beijing", "Bangkok", "Istanbul", "Ankara",
  "Washington", "Ottawa", "Mexico City", "Buenos Aires", "Cairo", "Nairobi",
  "Canberra", "Wellington", "Moscow", "Minsk", "Tbilisi", "Yerevan", "Baku",
  "Chisinau", "Tallinn", "Riga", "Vilnius", "Belgrade", "Zagreb", "Ljubljana",
  "Bratislava", "Bern", "Luxembourg", "Monaco", "Andorra la Vella", "Valletta",
  "Nicosia", "Reykjavik", "Edinburgh", "Cardiff", "Belfast",
]);

function countCapitals(visits: Visit[]): number {
  const capitals = new Set<string>();
  for (const v of visits) {
    if (KNOWN_CAPITALS.has(v.city) || v.city.toLowerCase().includes("capital")) {
      capitals.add(v.city);
    }
  }
  return capitals.size;
}

export function computeStats(visits: Visit[]): TravelStats {
  const cities = new Set<string>();
  const countries = new Set<string>();
  const continents = new Set<string>();

  for (const visit of visits) {
    cities.add(`${visit.city}|${visit.countryCode}`);
    countries.add(visit.countryCode);
    if (visit.continent) continents.add(visit.continent);
  }

  return {
    totalVisits: visits.length,
    uniqueCities: cities.size,
    uniqueCountries: countries.size,
    uniqueContinents: continents.size,
    countries: [...countries],
    continents: [...continents],
  };
}

export function computeAchievements(visits: Visit[]): Achievement[] {
  const ctx = buildContext(visits);

  return ACHIEVEMENT_DEFS.map((def) => {
    const rawProgress = def.getProgress(ctx);
    const progress = Math.min(rawProgress, def.target);
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      tier: def.tier,
      target: def.target,
      progress,
      unlocked: rawProgress >= def.target,
    };
  });
}

export function getUnlockedCount(achievements: Achievement[]): number {
  return achievements.filter((a) => a.unlocked).length;
}

export const TIER_COLORS: Record<Achievement["tier"], string> = {
  bronze: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  silver: "text-slate-300 bg-slate-400/10 border-slate-400/20",
  gold: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  platinum: "text-violet-300 bg-violet-500/10 border-violet-500/20",
};
