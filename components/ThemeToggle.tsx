"use client";

import { useEffect, useState } from "react";
import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi2";

type Theme = "light" | "dark";

function resolveTheme(): Theme {
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(resolveTheme());
  }, []);

  function toggle() {
    const next: Theme = (theme ?? resolveTheme()) === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("theme", next);
    setTheme(next);
  }

  const isDark = theme === "dark";
  const label = isDark ? "라이트 모드로 보기" : "다크 모드로 보기";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {isDark ? (
        <HiOutlineSun aria-hidden="true" />
      ) : (
        <HiOutlineMoon aria-hidden="true" />
      )}
    </button>
  );
}
