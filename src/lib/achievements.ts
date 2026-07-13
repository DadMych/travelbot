import type { Visit } from "@/lib/db/schema";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  Compass,
  Flag,
  Footprints,
  Globe,
  Globe2,
  Map,
  MapPin,
  Mountain,
  Plane,
  Ship,
  Sparkles,
  Star,
  Sun,
  Trophy,
  Users,
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

function countUnique<T>(items: T[], key: (item: T) => string): number {
  return new Set(items.map(key)).size;
}

function countEuropeanCountries(visits: Visit[]): number {
  return countUnique(
    visits.filter((v) => EU_COUNTRIES.has(v.countryCode)),
    (v) => v.countryCode
  );
}

export function computeAchievements(visits: Visit[]): Achievement[] {
  const stats = computeStats(visits);
  const europeanCountries = countEuropeanCountries(visits);

  const definitions: Omit<Achievement, "progress" | "unlocked">[] = [
    {
      id: "first_step",
      title: "Первый шаг",
      description: "Добавил первое место на карту",
      icon: Footprints,
      tier: "bronze",
      target: 1,
    },
    {
      id: "city_explorer_5",
      title: "Городской исследователь",
      description: "Посетил 5 разных городов",
      icon: MapPin,
      tier: "bronze",
      target: 5,
    },
    {
      id: "city_explorer_15",
      title: "Метрополитен",
      description: "15 городов на карте",
      icon: Compass,
      tier: "silver",
      target: 15,
    },
    {
      id: "city_explorer_30",
      title: "Городской легенда",
      description: "30 городов — серьёзный масштаб",
      icon: Star,
      tier: "gold",
      target: 30,
    },
    {
      id: "country_3",
      title: "Заграничный",
      description: "3 разные страны",
      icon: Flag,
      tier: "bronze",
      target: 3,
    },
    {
      id: "country_10",
      title: "Глобус в кармане",
      description: "10 стран на карте",
      icon: Globe,
      tier: "silver",
      target: 10,
    },
    {
      id: "country_25",
      title: "Мировой гражданин",
      description: "25 стран — ты everywhere",
      icon: Globe2,
      tier: "gold",
      target: 25,
    },
    {
      id: "continent_3",
      title: "Три материка",
      description: "Побывал на 3 континентах",
      icon: Map,
      tier: "silver",
      target: 3,
    },
    {
      id: "continent_5",
      title: "Пятиконтинентальный",
      description: "5 континентов — почти весь мир",
      icon: Trophy,
      tier: "platinum",
      target: 5,
    },
    {
      id: "europe_5",
      title: "Европейский тур",
      description: "5 стран Европы",
      icon: Plane,
      tier: "silver",
      target: 5,
    },
    {
      id: "europe_10",
      title: "Евро-мастер",
      description: "10 европейских стран",
      icon: Award,
      tier: "gold",
      target: 10,
    },
    {
      id: "visits_10",
      title: "В пути",
      description: "10 отметок на карте",
      icon: Sun,
      tier: "bronze",
      target: 10,
    },
    {
      id: "visits_50",
      title: "Номад",
      description: "50 отметок — постоянное движение",
      icon: Ship,
      tier: "gold",
      target: 50,
    },
    {
      id: "visits_100",
      title: "Легенда путешествий",
      description: "100 мест — это уже lifestyle",
      icon: Sparkles,
      tier: "platinum",
      target: 100,
    },
    {
      id: "mountain",
      title: "Высота",
      description: "Посетил место типа «город в горах» (region содержит горный регион)",
      icon: Mountain,
      tier: "bronze",
      target: 1,
    },
    {
      id: "social",
      title: "Компания",
      description: "5+ отметок с заметками",
      icon: Users,
      tier: "bronze",
      target: 5,
    },
  ];

  function getProgress(id: string): number {
    switch (id) {
      case "first_step":
      case "visits_10":
      case "visits_50":
      case "visits_100":
        return stats.totalVisits;
      case "city_explorer_5":
      case "city_explorer_15":
      case "city_explorer_30":
        return stats.uniqueCities;
      case "country_3":
      case "country_10":
      case "country_25":
        return stats.uniqueCountries;
      case "continent_3":
      case "continent_5":
        return stats.uniqueContinents;
      case "europe_5":
      case "europe_10":
        return europeanCountries;
      case "mountain":
        return visits.filter(
          (v) =>
            v.region?.toLowerCase().includes("mount") ||
            v.city.toLowerCase().includes("alps") ||
            v.notes?.toLowerCase().includes("гор")
        ).length;
      case "social":
        return visits.filter((v) => v.notes && v.notes.length > 0).length;
      default:
        return 0;
    }
  }

  return definitions.map((def) => {
    const progress = getProgress(def.id);
    const unlocked = progress >= def.target;
    return {
      ...def,
      progress: Math.min(progress, def.target),
      unlocked,
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
