import { useEffect } from "react";
import type { ReactNode } from "react";
import { ThemeContext } from "../hooks/useTheme";
import { colors } from "../theme/colors";

interface ThemeProviderProps {
	children: ReactNode;
	isDarkMode: boolean;
	toggleTheme: () => void;
}

export function ThemeProvider({
	children,
	isDarkMode,
	toggleTheme,
}: ThemeProviderProps) {
	useEffect(() => {
		const root = document.documentElement;
		const theme = isDarkMode ? colors.dark : colors.light;

		// Update dark class on root
		if (isDarkMode) {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}

		// Update body styles
		document.body.className = isDarkMode
			? "bg-bg-dark text-text-primary-dark font-sans antialiased"
			: "bg-bg-light text-text-primary-light font-sans antialiased";

		// Update color scheme for native browser UI
		root.style.colorScheme = isDarkMode ? "dark" : "light";

		// Set CSS custom properties (for backward compatibility with old components)
		root.style.setProperty("--card-bg", theme.surface);
		root.style.setProperty("--card-border", theme.border);
		root.style.setProperty("--card-hover-bg", theme.surfaceHover);
		root.style.setProperty("--card-hover-border", theme.borderHover);
		root.style.setProperty("--input-bg", theme.surface);
		root.style.setProperty("--input-border", theme.border);
		root.style.setProperty("--input-text", theme.textPrimary);
		root.style.setProperty("--input-placeholder", theme.textTertiary);
		root.style.setProperty("--label-text", theme.textPrimary);
		root.style.setProperty("--help-text", theme.textSecondary);

		// Button colors - using new primary/secondary system
		if (isDarkMode) {
			root.style.setProperty("--btn-primary-bg", "#60A5FA"); // primary-dark
			root.style.setProperty("--btn-primary-text", "#18181B"); // bg-dark
			root.style.setProperty("--btn-primary-hover", "#3B82F6");
			root.style.setProperty("--btn-secondary-bg", "#27272A");
			root.style.setProperty("--btn-secondary-text", "#FAFAF9");
			root.style.setProperty("--btn-secondary-border", "#3F3F46");
			root.style.setProperty("--btn-secondary-hover", "#3F3F46");
			root.style.setProperty("--btn-ghost-text", "#A1A1AA");
			root.style.setProperty("--btn-ghost-hover-text", "#FAFAF9");
			root.style.setProperty("--btn-ghost-hover-bg", "#3F3F46");
		} else {
			root.style.setProperty("--btn-primary-bg", "#3B82F6"); // primary
			root.style.setProperty("--btn-primary-text", "#FFFFFF");
			root.style.setProperty("--btn-primary-hover", "#2563EB");
			root.style.setProperty("--btn-secondary-bg", "#FFFFFF");
			root.style.setProperty("--btn-secondary-text", "#27272A");
			root.style.setProperty("--btn-secondary-border", "#E4E4E7");
			root.style.setProperty("--btn-secondary-hover", "#F5F5F4");
			root.style.setProperty("--btn-ghost-text", "#71717A");
			root.style.setProperty("--btn-ghost-hover-text", "#27272A");
			root.style.setProperty("--btn-ghost-hover-bg", "#F5F5F4");
		}

		root.style.setProperty("--btn-danger-bg", theme.danger);
		root.style.setProperty("--btn-danger-text", "#ffffff");
		root.style.setProperty("--btn-danger-hover", isDarkMode ? "#DC2626" : "#B91C1C");
	}, [isDarkMode]);

	return (
		<ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}
