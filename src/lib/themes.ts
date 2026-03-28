export type ThemeKey = "paper" | "midnight" | "forest";

export type ThemeDef = {
  key: ThemeKey;
  label: string;
  appClass: string;
  panelClass: string;
  textClass: string;
  mutedClass: string;
  accentClass: string;
};

export const THEMES: ThemeDef[] = [
  {
    key: "paper",
    label: "Paper",
    appClass: "bg-stone-100",
    panelClass: "bg-white border-stone-200",
    textClass: "text-stone-900",
    mutedClass: "text-stone-500",
    accentClass: "text-indigo-600",
  },
  {
    key: "midnight",
    label: "Midnight",
    appClass: "bg-slate-950",
    panelClass: "bg-slate-900 border-slate-700",
    textClass: "text-slate-100",
    mutedClass: "text-slate-400",
    accentClass: "text-cyan-300",
  },
  {
    key: "forest",
    label: "Forest",
    appClass: "bg-emerald-950",
    panelClass: "bg-emerald-900 border-emerald-700",
    textClass: "text-emerald-100",
    mutedClass: "text-emerald-300/80",
    accentClass: "text-lime-300",
  },
];

export const DEFAULT_THEME: ThemeKey = "paper";

export function getTheme(key: ThemeKey | string | null | undefined): ThemeDef {
  return THEMES.find((theme) => theme.key === key) ?? THEMES[0];
}
