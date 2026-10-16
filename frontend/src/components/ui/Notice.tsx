import type { ReactNode } from "react";

export type Tone = "neutral" | "up" | "signal" | "caution";

const toneBorder: Record<Tone, string> = {
	neutral: "border-line-strong",
	up: "border-up",
	signal: "border-signal",
	caution: "border-caution",
};

const toneText: Record<Tone, string> = {
	neutral: "text-muted",
	up: "text-up",
	signal: "text-signal",
	caution: "text-caution",
};

const toneBg: Record<Tone, string> = {
	neutral: "bg-faint",
	up: "bg-up",
	signal: "bg-signal",
	caution: "bg-caution",
};

export function Notice({
	tone = "neutral",
	title,
	children,
	action,
	className = "",
}: {
	tone?: Tone;
	title?: ReactNode;
	children?: ReactNode;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div
			role={tone === "signal" ? "alert" : "status"}
			className={`border-l-2 ${toneBorder[tone]} pl-4 py-1 flex flex-col gap-1.5 animate-fade-in ${className}`}
		>
			{title && <p className={`micro ${toneText[tone]}`}>{title}</p>}
			{children && (
				<div className="text-[13px] text-muted leading-relaxed wrap-break-word">{children}</div>
			)}
			{action && <div className="pt-1">{action}</div>}
		</div>
	);
}

export function Dot({ tone = "neutral" }: { tone?: Tone }) {
	return <span aria-hidden className={`inline-block w-1.5 h-1.5 shrink-0 ${toneBg[tone]}`} />;
}

export function StatusLabel({ tone, children }: { tone: Tone; children: ReactNode }) {
	return (
		<span className={`micro inline-flex items-center gap-2 ${toneText[tone]}`}>
			<Dot tone={tone} />
			{children}
		</span>
	);
}
