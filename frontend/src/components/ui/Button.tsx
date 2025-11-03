import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	icon?: ReactNode;
	fullWidth?: boolean;
	children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
	primary: `
		bg-primary hover:bg-primary-hover
		text-white
		dark:bg-primary-dark dark:hover:bg-primary-dark-hover
		shadow-soft hover:shadow-medium
	`,
	secondary: `
		bg-surface-light hover:bg-surface-hover-light
		text-text-primary-light
		border border-border-light hover:border-border-hover-light
		dark:bg-surface-dark dark:hover:bg-surface-hover-dark
		dark:text-text-primary-dark
		dark:border-border-dark dark:hover:border-border-hover-dark
	`,
	ghost: `
		bg-transparent hover:bg-surface-hover-light
		text-text-secondary-light hover:text-text-primary-light
		dark:hover:bg-surface-hover-dark
		dark:text-text-secondary-dark dark:hover:text-text-primary-dark
	`,
	danger: `
		bg-danger hover:bg-danger-dark
		text-white
		shadow-soft hover:shadow-medium
	`,
	success: `
		bg-success hover:bg-success-dark
		text-white
		shadow-soft hover:shadow-medium
	`,
};

const sizeClasses: Record<ButtonSize, string> = {
	sm: 'px-3 py-1.5 text-sm rounded-md',
	md: 'px-4 py-2.5 text-base rounded-md',
	lg: 'px-6 py-3.5 text-lg rounded-lg',
};

export function Button({
	variant = 'primary',
	size = 'md',
	loading = false,
	icon,
	disabled,
	fullWidth = false,
	children,
	className = '',
	...props
}: ButtonProps) {
	const isDisabled = disabled || loading;

	return (
		<button
			className={`
				inline-flex items-center justify-center gap-2
				font-medium
				transition-all duration-200
				focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
				disabled:opacity-50 disabled:cursor-not-allowed
				${variantClasses[variant]}
				${sizeClasses[size]}
				${fullWidth ? 'w-full' : ''}
				${className}
			`}
			disabled={isDisabled}
			{...props}
		>
			{loading && <Loader2 className="w-4 h-4 animate-spin" />}
			{!loading && icon && <span className="flex-shrink-0">{icon}</span>}
			{children}
		</button>
	);
}

