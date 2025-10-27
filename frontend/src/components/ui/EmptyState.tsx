import { ReactNode } from 'react';

export interface EmptyStateProps {
	icon?: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
}

export function EmptyState({
	icon,
	title,
	description,
	action,
	className = '',
}: EmptyStateProps) {
	return (
		<div
			className={`
				flex flex-col items-center justify-center
				text-center py-12 px-6
				${className}
			`}
		>
			{icon && (
				<div className="w-16 h-16 mb-4 text-text-tertiary-light dark:text-text-tertiary-dark">
					{icon}
				</div>
			)}

			<h3 className="text-lg font-semibold mb-2 text-text-primary-light dark:text-text-primary-dark">
				{title}
			</h3>

			{description && (
				<p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-6 max-w-md">
					{description}
				</p>
			)}

			{action && <div>{action}</div>}
		</div>
	);
}

