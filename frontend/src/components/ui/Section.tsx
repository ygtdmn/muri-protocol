import type { ReactNode } from "react";

// Editorial row used across the site: title on the left, flat surface panel on the right.
export function Section({
	title,
	description,
	children,
	id,
	panel = true,
	stacked = false,
}: {
	title: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	id?: string;
	panel?: boolean;
	/** Heading above the panel instead of beside it, for narrow columns. */
	stacked?: boolean;
}) {
	return (
		<section
			id={id}
			className={`grid gap-x-12 gap-y-4 scroll-mt-24 ${
				stacked ? "" : "xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
			}`}
		>
			<header className={`flex flex-col gap-2 ${stacked ? "" : "xl:pt-8"}`}>
				<h2 className="font-medium tracking-[-0.01em] leading-tight text-pretty text-[clamp(1.3rem,1.05rem+0.7vw,1.7rem)]">
					{title}
				</h2>
				{description && (
					<p className="text-[13px] text-muted leading-relaxed max-w-[40ch]">
						{description}
					</p>
				)}
			</header>
			<div className="min-w-0">{panel ? <Panel>{children}</Panel> : children}</div>
		</section>
	);
}

export function Panel({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={`bg-surface p-5 sm:p-6 md:p-8 lg:p-10 ${className}`}>{children}</div>
	);
}

// Thin divider with an optional mono label, for splitting a panel into parts.
export function Rule({ label }: { label?: string }) {
	if (!label) return <hr className="border-line" />;
	return (
		<div className="flex items-center gap-4">
			<span className="micro text-faint whitespace-nowrap">{label}</span>
			<hr className="flex-1 border-line" />
		</div>
	);
}

export function PageTitle({
	back,
	title,
	children,
}: {
	/** A link back to where the user came from. */
	back?: ReactNode;
	title: ReactNode;
	children?: ReactNode;
}) {
	return (
		<div className="lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-x-14 lg:items-end">
			<div className="flex flex-col gap-4">
				{back && <span className="text-[13px] text-muted">{back}</span>}
				<h1 className="font-medium leading-[1.02] tracking-[-0.02em] text-balance text-[clamp(2rem,1rem+3.1vw,3.5rem)]">
					{title}
				</h1>
			</div>
			{children && (
				<div className="mt-5 lg:mt-0 text-muted leading-relaxed text-pretty max-w-[62ch] text-[clamp(1rem,0.94rem+0.3vw,1.15rem)]">
					{children}
				</div>
			)}
		</div>
	);
}
