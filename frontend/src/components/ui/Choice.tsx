import type { ReactNode } from "react";

// Selectable row for radio groups and checkbox lists. Square indicator, flat border.
export function Choice({
	type,
	name,
	checked,
	onChange,
	title,
	description,
	meta,
	disabled,
	compact,
}: {
	type: "radio" | "checkbox";
	name?: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	title: ReactNode;
	description?: ReactNode;
	meta?: ReactNode;
	disabled?: boolean;
	compact?: boolean;
}) {
	return (
		<label
			className={`group relative flex items-start gap-3 border transition-colors ${
				compact ? "px-3 py-2.5" : "p-4"
			} ${
				disabled
					? "border-line opacity-45 cursor-not-allowed"
					: checked
						? "border-foreground cursor-pointer"
						: "border-line-strong hover:border-muted cursor-pointer"
			}`}
		>
			<input
				type={type}
				name={name}
				checked={checked}
				disabled={disabled}
				onChange={(e) => onChange(e.target.checked)}
				className="peer sr-only"
			/>
			<span
				aria-hidden
				className={`mt-[3px] grid place-items-center w-3.5 h-3.5 shrink-0 border transition-colors peer-focus-visible:outline-solid peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground ${
					checked ? "border-foreground" : "border-line-strong"
				}`}
			>
				<span
					className={`w-1.5 h-1.5 bg-foreground transition-transform duration-150 ${
						checked ? "scale-100" : "scale-0"
					}`}
				/>
			</span>
			<span className="flex-1 min-w-0 flex flex-col gap-1">
				<span className="flex items-baseline justify-between gap-3">
					<span className={compact ? "text-[14px]" : "font-medium"}>{title}</span>
					{meta && <span className="micro text-faint shrink-0">{meta}</span>}
				</span>
				{description && (
					<span className="text-[13px] text-muted leading-relaxed">{description}</span>
				)}
			</span>
		</label>
	);
}
