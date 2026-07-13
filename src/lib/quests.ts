import type { Visit } from "@/lib/db/schema";

export interface QuestTarget {
  id: string;
  label: string;
  country: string;
  countryCode: string;
  aliases: string[];
}

export interface QuestItem extends QuestTarget {
  visited: boolean;
  matchedCity?: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: number;
  total: number;
  completed: boolean;
  items: QuestItem[];
}

function normalizeCity(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "")
    .trim();
}

function visitMatchesTarget(visit: Visit, target: QuestTarget): boolean {
  if (visit.countryCode !== target.countryCode) return false;
  const city = normalizeCity(visit.city);
  return target.aliases.some((alias) => normalizeCity(alias) === city);
}

export const EUROPEAN_CAPITALS: QuestTarget[] = [
  { id: "tirana", label: "Тирана", country: "Albania", countryCode: "AL", aliases: ["Tirana", "Тирана"] },
  { id: "andorra", label: "Андорра-ла-Велья", country: "Andorra", countryCode: "AD", aliases: ["Andorra la Vella"] },
  { id: "vienna", label: "Відень", country: "Austria", countryCode: "AT", aliases: ["Vienna", "Wien", "Відень"] },
  { id: "minsk", label: "Мінськ", country: "Belarus", countryCode: "BY", aliases: ["Minsk", "Мінськ"] },
  { id: "brussels", label: "Брussels", country: "Belgium", countryCode: "BE", aliases: ["Brussels", "Bruxelles", "Brussel"] },
  { id: "sarajevo", label: "Сараєво", country: "Bosnia", countryCode: "BA", aliases: ["Sarajevo", "Сараєво"] },
  { id: "sofia", label: "Софія", country: "Bulgaria", countryCode: "BG", aliases: ["Sofia", "Софія"] },
  { id: "zagreb", label: "Загreb", country: "Croatia", countryCode: "HR", aliases: ["Zagreb", "Загreb"] },
  { id: "nicosia", label: "Нікосія", country: "Cyprus", countryCode: "CY", aliases: ["Nicosia", "Нікосія"] },
  { id: "prague", label: "Прага", country: "Czechia", countryCode: "CZ", aliases: ["Prague", "Praha", "Прага"] },
  { id: "copenhagen", label: "Копенгаген", country: "Denmark", countryCode: "DK", aliases: ["Copenhagen", "København", "Копенгаген"] },
  { id: "tallinn", label: "Таллінн", country: "Estonia", countryCode: "EE", aliases: ["Tallinn", "Таллінн"] },
  { id: "helsinki", label: "Гельсінкі", country: "Finland", countryCode: "FI", aliases: ["Helsinki", "Гельсінкі"] },
  { id: "paris", label: "Париж", country: "France", countryCode: "FR", aliases: ["Paris", "Париж"] },
  { id: "berlin", label: "Берлін", country: "Germany", countryCode: "DE", aliases: ["Berlin", "Берлін"] },
  { id: "athens", label: "Афіни", country: "Greece", countryCode: "GR", aliases: ["Athens", "Athina", "Афіни"] },
  { id: "budapest", label: "Будапешт", country: "Hungary", countryCode: "HU", aliases: ["Budapest", "Будапешт"] },
  { id: "reykjavik", label: "Рейkjavik", country: "Iceland", countryCode: "IS", aliases: ["Reykjavik", "Reykjavík"] },
  { id: "dublin", label: "Дублін", country: "Ireland", countryCode: "IE", aliases: ["Dublin", "Дублін"] },
  { id: "rome", label: "Рим", country: "Italy", countryCode: "IT", aliases: ["Rome", "Roma", "Рим"] },
  { id: "pristina", label: "Приштина", country: "Kosovo", countryCode: "XK", aliases: ["Pristina", "Приштина"] },
  { id: "riga", label: "Рига", country: "Latvia", countryCode: "LV", aliases: ["Riga", "Рига"] },
  { id: "vaduz", label: "Vaduz", country: "Liechtenstein", countryCode: "LI", aliases: ["Vaduz"] },
  { id: "vilnius", label: "Вільнюс", country: "Lithuania", countryCode: "LT", aliases: ["Vilnius", "Вільнюс"] },
  { id: "luxembourg", label: "Люксембург", country: "Luxembourg", countryCode: "LU", aliases: ["Luxembourg", "Luxembourg City"] },
  { id: "valletta", label: "Валletta", country: "Malta", countryCode: "MT", aliases: ["Valletta"] },
  { id: "chisinau", label: "Кишинів", country: "Moldova", countryCode: "MD", aliases: ["Chisinau", "Chișinău", "Кишинів"] },
  { id: "monaco", label: "Монако", country: "Monaco", countryCode: "MC", aliases: ["Monaco", "Monte Carlo"] },
  { id: "podgorica", label: "Подgorica", country: "Montenegro", countryCode: "ME", aliases: ["Podgorica"] },
  { id: "amsterdam", label: "Амsterdam", country: "Netherlands", countryCode: "NL", aliases: ["Amsterdam", "Амsterdam"] },
  { id: "skopje", label: "Сkopje", country: "North Macedonia", countryCode: "MK", aliases: ["Skopje"] },
  { id: "oslo", label: "Oslo", country: "Norway", countryCode: "NO", aliases: ["Oslo"] },
  { id: "warsaw", label: "Варшава", country: "Poland", countryCode: "PL", aliases: ["Warsaw", "Warszawa", "Варшава"] },
  { id: "lisbon", label: "Lісbon", country: "Portugal", countryCode: "PT", aliases: ["Lisbon", "Lisboa", "Лісbon"] },
  { id: "bucharest", label: "Бухarest", country: "Romania", countryCode: "RO", aliases: ["Bucharest", "București"] },
  { id: "san-marino", label: "San Marino", country: "San Marino", countryCode: "SM", aliases: ["San Marino", "City of San Marino"] },
  { id: "belgrade", label: "Бelgrade", country: "Serbia", countryCode: "RS", aliases: ["Belgrade", "Beograd"] },
  { id: "bratislava", label: "Бratislava", country: "Slovakia", countryCode: "SK", aliases: ["Bratislava", "Бratislava"] },
  { id: "ljubljana", label: "Ljubljana", country: "Slovenia", countryCode: "SI", aliases: ["Ljubljana"] },
  { id: "madrid", label: "Мadrid", country: "Spain", countryCode: "ES", aliases: ["Madrid", "Мadrid"] },
  { id: "stockholm", label: "Stockholm", country: "Sweden", countryCode: "SE", aliases: ["Stockholm"] },
  { id: "bern", label: "Берн", country: "Switzerland", countryCode: "CH", aliases: ["Bern", "Berne", "Берн"] },
  { id: "london", label: "Лondon", country: "United Kingdom", countryCode: "GB", aliases: ["London", "Лondon"] },
  { id: "kyiv", label: "Київ", country: "Ukraine", countryCode: "UA", aliases: ["Kyiv", "Kiev", "Київ", "Киев"] },
  { id: "vatican", label: "Vatican", country: "Vatican", countryCode: "VA", aliases: ["Vatican City", "Città del Vaticano"] },
];

function buildQuest(
  id: string,
  title: string,
  description: string,
  icon: string,
  targets: QuestTarget[],
  visits: Visit[]
): Quest {
  const items: QuestItem[] = targets.map((target) => {
    const match = visits.find((v) => visitMatchesTarget(v, target));
    return {
      ...target,
      visited: Boolean(match),
      matchedCity: match?.city,
    };
  });

  const progress = items.filter((i) => i.visited).length;

  return {
    id,
    title,
    description,
    icon,
    progress,
    total: items.length,
    completed: progress === items.length,
    items,
  };
}

export function computeQuests(visits: Visit[]): Quest[] {
  return [
    buildQuest(
      "european_capitals",
      "Європейські столиці",
      "Відвідай усі столиці європейських держав — класичний квест мандрівника.",
      "Landmark",
      EUROPEAN_CAPITALS,
      visits
    ),
  ];
}

export interface TimelineBucket {
  year: number | null;
  label: string;
  count: number;
  months: { month: number; label: string; count: number }[];
}

const MONTH_LABELS = [
  "Січ", "Лют", "Бер", "Кві", "Тра", "Чер",
  "Лип", "Сер", "Вер", "Жов", "Лис", "Гру",
];

export function buildTimeline(visits: Visit[]): TimelineBucket[] {
  const buckets = new Map<number | "unknown", Visit[]>();

  for (const visit of visits) {
    const key = visit.visitedAt
      ? new Date(visit.visitedAt).getUTCFullYear()
      : "unknown";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(visit);
  }

  const result: TimelineBucket[] = [];

  const unknown = buckets.get("unknown");
  if (unknown?.length) {
    result.push({
      year: null,
      label: "Без дати",
      count: unknown.length,
      months: [],
    });
  }

  const years = [...buckets.keys()]
    .filter((k): k is number => k !== "unknown")
    .sort((a, b) => b - a);

  for (const year of years) {
    const yearVisits = buckets.get(year)!;
    const monthMap = new Map<number, number>();

    for (const v of yearVisits) {
      if (!v.visitedAt) continue;
      const m = new Date(v.visitedAt).getUTCMonth();
      monthMap.set(m, (monthMap.get(m) ?? 0) + 1);
    }

    result.push({
      year,
      label: String(year),
      count: yearVisits.length,
      months: [...monthMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([month, count]) => ({
          month,
          label: MONTH_LABELS[month],
          count,
        })),
    });
  }

  return result;
}

export function filterVisitsByTimeline(
  visits: Visit[],
  year: number | null | "all",
  month?: number | null
): Visit[] {
  if (year === "all") return visits;

  return visits.filter((v) => {
    if (year === null) return !v.visitedAt;
    if (!v.visitedAt) return false;
    const d = new Date(v.visitedAt);
    if (d.getUTCFullYear() !== year) return false;
    if (month != null && d.getUTCMonth() !== month) return false;
    return true;
  });
}
