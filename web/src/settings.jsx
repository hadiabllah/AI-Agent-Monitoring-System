import { createContext, useContext, useEffect, useState } from "react";

export const DEFAULT_SETTINGS = {
  theme: "system", // system | light | dark
  compact: false, // denser feed rows
  defaultRange: "1h", // initial time range on page load
  defaultAgent: "all", // initial agent filter on page load
  idleMinutes: 5, // a session with no events for this long is "Idle"
  pageSize: 200, // feed rows shown before "Show older events"
  clock: "24h", // 24h | 12h
  showRelative: true, // "2m ago" under each feed timestamp
  notifyErrors: false, // desktop notification when an error event arrives
};

const KEY = "agent-monitor:settings";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    // Older versions stored the theme on its own.
    const legacyTheme = localStorage.getItem("theme");
    return { ...DEFAULT_SETTINGS, ...(legacyTheme ? { theme: legacyTheme } : {}), ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable: settings last for this tab only */
    }
    const root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", settings.theme);
  }, [settings]);

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const reset = () => setSettings({ ...DEFAULT_SETTINGS });

  return (
    <SettingsContext.Provider value={{ settings, update, reset }}>
      <ProfileProvider>{children}</ProfileProvider>
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

// Minimal hash router: "#/settings" → "settings", "#/user" → "user", anything else → "dashboard".
export function useRoute() {
  const read = () => {
    const r = window.location.hash.replace(/^#\/?/, "");
    return r === "settings" || r === "user" ? r : "dashboard";
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onHash = () => setRoute(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

// The local user's profile (name, role, avatar colour). Stored apart from settings so
// "Reset to defaults" on the Settings page leaves it alone.
const PROFILE_KEY = "agent-monitor:profile";
export const DEFAULT_PROFILE = { name: "", role: "", color: "claude" };

function loadProfile() {
  try {
    return { ...DEFAULT_PROFILE, ...JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

const ProfileContext = createContext(null);

function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(loadProfile);
  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      /* storage unavailable: profile lasts for this tab only */
    }
  }, [profile]);
  const update = (patch) => setProfile((p) => ({ ...p, ...patch }));
  return <ProfileContext.Provider value={{ profile, update }}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}
