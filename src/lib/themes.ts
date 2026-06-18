import type { ThemeMode } from "./types";

export const THEME_PALETTES: Record<
  ThemeMode,
  {
    appBg: string;
    text: string;
    sceneBackground: string;
    fog: string;
    floor: string;
    tank: string;
    particle: string;
    modalBg: string;
    modalText: string;
  }
> = {
  light: {
    appBg: "#f5f3ee",
    text: "#121212",
    sceneBackground: "#f5f3ee",
    fog: "#fbfaf6",
    floor: "#e9e5dc",
    tank: "#191919",
    particle: "#2f2f2f",
    modalBg: "#ffffff",
    modalText: "#121212",
  },
  dark: {
    appBg: "#030303",
    text: "#f4f4f1",
    sceneBackground: "#030303",
    fog: "#080808",
    floor: "#070707",
    tank: "#f4f4f1",
    particle: "#f4f4f1",
    modalBg: "#0d0d0d",
    modalText: "#f4f4f1",
  },
};
