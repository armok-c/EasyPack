import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "easypack-theme";
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: "light",
  toggleTheme: () => {},
});

function readTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    // 主窗口与悬浮窗使用相同来源的存储，切换后同步已打开的窗口。
    const syncTheme = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === STORAGE_KEY || event.key === null)) {
        setTheme(readTheme());
      }
    };
    window.addEventListener("storage", syncTheme);
    setTheme(readTheme());
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 存储不可用时，仍允许当前窗口切换外观。
    }
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
