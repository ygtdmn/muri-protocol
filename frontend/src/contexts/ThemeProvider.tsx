import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { ThemeContext } from "../hooks/useTheme";

const STORAGE_KEY = "muri-theme";

// index.html applies the saved theme before first paint; read it back from the DOM.
const readInitialTheme = () =>
	document.documentElement.classList.contains("dark");

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [isDarkMode, setIsDarkMode] = useState(readInitialTheme);

	const toggleTheme = useCallback(() => {
		setIsDarkMode((prev) => {
			const next = !prev;
			document.documentElement.classList.toggle("dark", next);
			try {
				localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
			} catch {
				// Storage can be unavailable (private mode); the toggle still works for this session.
			}
			return next;
		});
	}, []);

	return (
		<ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}
