export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

const base =
	"inline-flex items-center justify-center gap-2 font-mono uppercase tracking-[0.16em] whitespace-nowrap select-none transition-[opacity,color,background-color,border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-35";

const variants: Record<ButtonVariant, string> = {
	primary: "bg-foreground text-background hover:opacity-80 disabled:hover:opacity-35",
	secondary:
		"border border-line-strong text-foreground hover:border-foreground disabled:hover:border-line-strong",
	ghost: "text-muted hover:text-foreground",
	danger:
		"border border-signal text-signal hover:bg-signal hover:text-background disabled:hover:bg-transparent disabled:hover:text-signal",
};

const sizes: Record<ButtonSize, string> = {
	md: "h-11 px-5 text-[11px]",
	sm: "h-8 px-3 text-[10px]",
};

export function buttonClass({
	variant = "primary",
	size = "md",
	fullWidth = false,
	className = "",
}: {
	variant?: ButtonVariant;
	size?: ButtonSize;
	fullWidth?: boolean;
	className?: string;
} = {}) {
	const ghostPadding = variant === "ghost" ? "px-0! h-auto!" : "";
	return `${base} ${variants[variant]} ${sizes[size]} ${ghostPadding} ${fullWidth ? "w-full" : ""} ${className}`;
}
