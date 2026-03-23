"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_THEME, ThemeKey } from "@/lib/themes";

type LayoutMode = "infinite" | "paginated";

type ReaderSettingsState = {
  theme: ThemeKey;
  fontSize: number;
  lineHeight: number;
  layoutMode: LayoutMode;
  showOutline: boolean;
  setTheme: (theme: ThemeKey) => void;
  setFontSize: (fontSize: number) => void;
  setLineHeight: (lineHeight: number) => void;
  setLayoutMode: (layoutMode: LayoutMode) => void;
  setShowOutline: (showOutline: boolean) => void;
};

export const useReaderSettingsStore = create<ReaderSettingsState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      fontSize: 18,
      lineHeight: 1.8,
      layoutMode: "infinite",
      showOutline: true,
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setLayoutMode: (layoutMode) => set({ layoutMode }),
      setShowOutline: (showOutline) => set({ showOutline }),
    }),
    {
      name: "typingmonkey-reader-settings",
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        layoutMode: state.layoutMode,
        showOutline: state.showOutline,
      }),
    },
  ),
);
