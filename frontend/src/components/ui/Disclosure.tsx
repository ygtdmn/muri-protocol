import type { ReactNode } from "react";

/** A collapsed panel for options most people never need. Closed by default. */
export function Disclosure({
	title,
	summary,
	children,
	defaultOpen = false,
}: {
	title: ReactNode;
	/** One line shown next to the title while closed. */
	summary?: ReactNode;
	children: ReactNode;
	defaultOpen?: boolean;
}) {
	return (
		<details open={defaultOpen} className="group bg-surface">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-5 sm:px-6 md:px-8 py-5 [&::-webkit-details-marker]:hidden">
				<span className="flex flex-col gap-1">
					<span className="font-medium tracking-[-0.01em] text-[clamp(1.1rem,1rem+0.4vw,1.3rem)]">{title}</span>
					{summary && <span className="text-[13px] text-muted">{summary}</span>}
				</span>
				<span
					aria-hidden
					className="font-mono text-lg text-muted transition-transform duration-200 group-open:rotate-45"
				>
					+
				</span>
			</summary>
			<div className="border-t border-line p-5 sm:p-6 md:p-8">{children}</div>
		</details>
	);
}
