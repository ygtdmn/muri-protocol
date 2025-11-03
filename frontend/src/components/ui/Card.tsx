import type { ReactNode, HTMLAttributes } from 'react';

export type CardVariant = 'default' | 'hover' | 'bordered' | 'subtle';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
	variant?: CardVariant;
	padding?: CardPadding;
	hover?: boolean;
	className?: string;
}

const variantClasses: Record<CardVariant, string> = {
	default: `
		bg-surface-light
		dark:bg-surface-dark
		shadow-soft
	`,
	hover: `
		bg-surface-light hover:bg-surface-hover-light
		dark:bg-surface-dark dark:hover:bg-surface-hover-dark
		shadow-soft hover:shadow-medium
		cursor-pointer
		transition-all duration-200
	`,
	bordered: `
		bg-surface-light
		dark:bg-surface-dark
		border border-border-light
		dark:border-border-dark
	`,
	subtle: `
		bg-surface-hover-light
		dark:bg-surface-hover-dark
		border border-border-light
		dark:border-border-dark
	`,
};

const paddingClasses: Record<CardPadding, string> = {
	none: '',
	sm: 'p-4',
	md: 'p-6',
	lg: 'p-8',
};

export function Card({
	children,
	variant = 'default',
	padding = 'md',
	hover = false,
	onClick,
	className = '',
	...props
}: CardProps) {
	const effectiveVariant = hover ? 'hover' : variant;

	return (
		<div
			className={`
				rounded-lg
				${variantClasses[effectiveVariant]}
				${paddingClasses[padding]}
				${className}
			`}
			onClick={onClick}
			role={onClick ? 'button' : undefined}
			tabIndex={onClick ? 0 : undefined}
			onKeyDown={
				onClick
					? (e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								onClick(e as any);
							}
					  }
					: undefined
			}
			{...props}
		>
			{children}
		</div>
	);
}

