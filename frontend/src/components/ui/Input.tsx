import { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	helpText?: string;
	error?: string;
	icon?: ReactNode;
}

export function Input({
	label,
	helpText,
	error,
	icon,
	className = '',
	...props
}: InputProps) {
	return (
		<div className="w-full">
			{label && (
				<label className="block text-sm font-medium mb-2 text-text-primary-light dark:text-text-primary-dark">
					{label}
				</label>
			)}

			<div className="relative">
				{icon && (
					<div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary-light dark:text-text-tertiary-dark">
						{icon}
					</div>
				)}

				<input
					className={`
						w-full px-4 py-2.5 rounded-md
						bg-surface-light dark:bg-surface-dark
						border border-border-light dark:border-border-dark
						text-text-primary-light dark:text-text-primary-dark
						placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark
						focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
						transition-all duration-200
						disabled:opacity-50 disabled:cursor-not-allowed
						${icon ? 'pl-10' : ''}
						${error ? 'border-danger focus:ring-danger' : ''}
						${className}
					`}
					{...props}
				/>
			</div>

			{helpText && !error && (
				<p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
					{helpText}
				</p>
			)}

			{error && (
				<p className="mt-2 text-sm text-danger dark:text-danger-dark">
					{error}
				</p>
			)}
		</div>
	);
}

// Textarea variant
export interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
	label?: string;
	helpText?: string;
	error?: string;
	rows?: number;
}

export function Textarea({
	label,
	helpText,
	error,
	rows = 4,
	className = '',
	...props
}: TextareaProps) {
	return (
		<div className="w-full">
			{label && (
				<label className="block text-sm font-medium mb-2 text-text-primary-light dark:text-text-primary-dark">
					{label}
				</label>
			)}

			<textarea
				rows={rows}
				className={`
					w-full px-4 py-2.5 rounded-md
					bg-surface-light dark:bg-surface-dark
					border border-border-light dark:border-border-dark
					text-text-primary-light dark:text-text-primary-dark
					placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark
					focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					transition-all duration-200
					resize-none
					disabled:opacity-50 disabled:cursor-not-allowed
					${error ? 'border-danger focus:ring-danger' : ''}
					${className}
				`}
				{...props}
			/>

			{helpText && !error && (
				<p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
					{helpText}
				</p>
			)}

			{error && (
				<p className="mt-2 text-sm text-danger dark:text-danger-dark">
					{error}
				</p>
			)}
		</div>
	);
}

