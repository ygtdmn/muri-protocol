import { useRef, useState } from "react";
import type { ReactNode } from "react";

export function Dropzone({
	accept,
	onFile,
	title,
	hint,
	error,
	children,
	disabled,
	compact,
}: {
	accept?: string;
	onFile: (file: File) => void;
	title: ReactNode;
	hint?: ReactNode;
	error?: ReactNode;
	/** Rendered instead of the empty state once a file is chosen. */
	children?: ReactNode;
	disabled?: boolean;
	compact?: boolean;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);

	const pick = () => {
		if (!disabled) inputRef.current?.click();
	};

	return (
		<div className="flex flex-col gap-2">
			<div
				role="button"
				tabIndex={disabled ? -1 : 0}
				aria-disabled={disabled}
				onClick={pick}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						pick();
					}
				}}
				onDragOver={(e) => {
					e.preventDefault();
					if (!disabled) setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragging(false);
					const file = e.dataTransfer.files?.[0];
					if (file && !disabled) onFile(file);
				}}
				className={`relative border border-dashed transition-colors cursor-pointer outline-hidden focus-visible:border-foreground ${
					compact ? "p-5" : "p-6 md:p-8"
				} ${
					dragging
						? "border-foreground bg-background"
						: error
							? "border-signal"
							: "border-line-strong hover:border-muted"
				} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
			>
				{children ?? (
					<div
						className={`flex flex-col items-center justify-center text-center gap-2 ${
							compact ? "py-2" : "py-8 md:py-12"
						}`}
					>
						<span className={compact ? "text-[14px]" : "text-[17px] font-medium"}>{dragging ? "Release to add" : title}</span>
						{hint && <span className="text-[13px] text-muted max-w-[44ch]">{hint}</span>}
					</div>
				)}
				<input
					ref={inputRef}
					type="file"
					accept={accept}
					className="hidden"
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) onFile(file);
						e.target.value = "";
					}}
				/>
			</div>
			{error && <p className="text-[13px] text-signal">{error}</p>}
		</div>
	);
}
