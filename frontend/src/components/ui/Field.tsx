import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export interface FieldProps {
	label: ReactNode;
	htmlFor?: string;
	hint?: ReactNode;
	error?: ReactNode;
	optional?: boolean;
	children: ReactNode;
	className?: string;
}

export function Field({
	label,
	htmlFor,
	hint,
	error,
	optional,
	children,
	className = "",
}: FieldProps) {
	return (
		<div className={`flex flex-col gap-2 ${className}`}>
			<label htmlFor={htmlFor} className="micro text-muted flex items-baseline gap-2">
				{label}
				{optional && <span className="text-faint">Optional</span>}
			</label>
			{children}
			{error ? (
				<p className="text-[13px] text-signal">{error}</p>
			) : hint ? (
				<p className="text-[13px] text-muted leading-relaxed">{hint}</p>
			) : null}
		</div>
	);
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
	function Input({ className = "", ...props }, ref) {
		return <input ref={ref} className={`field ${className}`} {...props} />;
	}
);

export const Textarea = forwardRef<
	HTMLTextAreaElement,
	TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...props }, ref) {
	return <textarea ref={ref} className={`field ${className}`} {...props} />;
});
