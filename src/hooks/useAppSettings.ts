import { useState, useRef, useEffect } from "react";
import type { ThemeMode, Locale, WindVector, WaveGestureState } from "@/lib/types";

export function useAppSettings() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [enableBalloonFall, setEnableBalloonFall] = useState(true);
  const [enableGestureWind, setEnableGestureWind] = useState(true);
  const [windStrength, setWindStrength] = useState(2.6);
  const [locale, setLocale] = useState<Locale>("en");

  const enableBalloonFallRef = useRef(enableBalloonFall);
  const enableGestureWindRef = useRef(enableGestureWind);
  const windStrengthRef = useRef(windStrength);
  const windStateRef = useRef<WindVector>({ x: 0, y: 0, z: 0 });
  const windTargetRef = useRef<WindVector>({ x: 0, y: 0, z: 0 });
  const waveGestureStateRef = useRef<WaveGestureState>({
    active: false,
    lastX: 0,
    lastY: 0,
    lastZ: 0,
    lastTime: 0,
  });

  const toggleThemeMode = () => {
    setThemeMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Sync refs with state
  useEffect(() => {
    enableBalloonFallRef.current = enableBalloonFall;
  }, [enableBalloonFall]);

  useEffect(() => {
    enableGestureWindRef.current = enableGestureWind;
  }, [enableGestureWind]);

  useEffect(() => {
    windStrengthRef.current = windStrength;
  }, [windStrength]);

  // Reset wind state when wind is disabled
  useEffect(() => {
    if (!enableGestureWind) {
      waveGestureStateRef.current.active = false;
      windTargetRef.current.x = 0;
      windTargetRef.current.y = 0;
      windTargetRef.current.z = 0;
      windStateRef.current.x = 0;
      windStateRef.current.y = 0;
      windStateRef.current.z = 0;
    }
  }, [enableGestureWind]);

  // When fall is disabled, force wind off too
  useEffect(() => {
    if (!enableBalloonFall) {
      setEnableGestureWind(false);
      enableGestureWindRef.current = false;
    }
  }, [enableBalloonFall]);

  // Apply data-theme attribute for CSS
  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem("themeMode", themeMode);
  }, [themeMode]);

  // Persist settings to localStorage
  useEffect(() => {
    window.localStorage.setItem("enableBalloonFall", String(enableBalloonFall));
  }, [enableBalloonFall]);

  useEffect(() => {
    window.localStorage.setItem("enableGestureWind", String(enableGestureWind));
  }, [enableGestureWind]);

  useEffect(() => {
    window.localStorage.setItem("windStrength", String(windStrength));
  }, [windStrength]);

  // Restore settings from localStorage on mount
  useEffect(() => {
    const savedTheme = window.localStorage.getItem("themeMode");
    const savedFall = window.localStorage.getItem("enableBalloonFall");
    const savedWind = window.localStorage.getItem("enableGestureWind");
    const savedWindStrength = window.localStorage.getItem("windStrength");
    if (savedTheme === "dark" || savedTheme === "light") {
      setThemeMode(savedTheme);
    }
    const fallEnabled = savedFall !== null ? savedFall === "true" : true;
    if (savedFall !== null) {
      setEnableBalloonFall(fallEnabled);
      enableBalloonFallRef.current = fallEnabled;
    }
    if (savedWind !== null) {
      const windEnabled = fallEnabled ? savedWind === "true" : false;
      setEnableGestureWind(windEnabled);
      enableGestureWindRef.current = windEnabled;
    }
    if (savedWindStrength !== null) {
      const parsedStrength = Number(savedWindStrength);
      if (Number.isFinite(parsedStrength)) {
        const nextStrength = Math.min(Math.max(parsedStrength, 0.8), 4);
        setWindStrength(nextStrength);
        windStrengthRef.current = nextStrength;
      }
    }
  }, []);

  return {
    themeMode,
    setThemeMode,
    toggleThemeMode,
    enableBalloonFall,
    setEnableBalloonFall,
    enableGestureWind,
    setEnableGestureWind,
    windStrength,
    setWindStrength,
    locale,
    setLocale,
    enableBalloonFallRef,
    enableGestureWindRef,
    windStrengthRef,
    windStateRef,
    windTargetRef,
    waveGestureStateRef,
  };
}
