import { ReactNode } from 'react';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
	variant?: BadgeVariant;
	size?: BadgeSize;
	children: ReactNode;
	dot?: boolean;
	className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
	primary: `
		bg-primary-subtle dark:bg-primary-dark-subtle
		text-primary dark:text-primary-dark
		border border-primary/20 dark:border-primary-dark/20
	`,
	secondary: `
		bg-secondary-subtle dark:bg-secondary-dark-subtle
		text-secondary dark:text-secondary-dark
		border border-secondary/20 dark:border-secondary-dark/20
	`,
	success: `
		bg-success-subtle dark:bg-success-dark-subtle
		text-success dark:text-success-dark
		border border-success/20 dark:border-success-dark/20
	`,
	warning: `
		bg-warning-subtle dark:bg-warning-dark-subtle
		text-warning dark:text-warning-dark
		border border-warning/20 dark:border-warning-dark/20
	`,
	danger: `
		bg-danger-subtle dark:bg-danger-dark-subtle
		text-danger dark:text-danger-dark
		border border-danger/20 dark:border-danger-dark/20
	`,
	info: `
		bg-info-subtle dark:bg-info-dark-subtle
		text-info dark:text-info-dark
		border border-info/20 dark:border-info-dark/20
	`,
	neutral: `
		bg-surface-hover-light dark:bg-surface-hover-dark
		text-text-secondary-light dark:text-text-secondary-dark
		border border-border-light dark:border-border-dark
	`,
};

const sizeClasses: Record<BadgeSize, string> = {
	sm: 'px-2 py-0.5 text-xs',
	md: 'px-2.5 py-1 text-sm',
	lg: 'px-3 py-1.5 text-base',
};

export function Badge({
	variant = 'neutral',
	size = 'md',
	children,
	dot = false,
	className = '',
}: BadgeProps) {
	return (
		<span
			className={`
				inline-flex items-center gap-1.5
				font-medium rounded-full
				${variantClasses[variant]}
				${sizeClasses[size]}
				${className}
			`}
		>
			{dot && (
				<span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
			)}
			{children}
		</span>
	);
}

