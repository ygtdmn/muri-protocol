import { ReactNode } from 'react';
import { Info, AlertCircle, CheckCircle, AlertTriangle, X } from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
	variant?: AlertVariant;
	title?: string;
	children: ReactNode;
	onClose?: () => void;
	className?: string;
}

const variantConfig = {
	info: {
		icon: Info,
		classes: `
			bg-info-subtle dark:bg-info-dark-subtle
			border-info dark:border-info-dark
			text-info dark:text-info-dark
		`,
		iconClasses: 'text-info dark:text-info-dark',
	},
	success: {
		icon: CheckCircle,
		classes: `
			bg-success-subtle dark:bg-success-dark-subtle
			border-success dark:border-success-dark
			text-success dark:text-success-dark
		`,
		iconClasses: 'text-success dark:text-success-dark',
	},
	warning: {
		icon: AlertTriangle,
		classes: `
			bg-warning-subtle dark:bg-warning-dark-subtle
			border-warning dark:border-warning-dark
			text-warning dark:text-warning-dark
		`,
		iconClasses: 'text-warning dark:text-warning-dark',
	},
	danger: {
		icon: AlertCircle,
		classes: `
			bg-danger-subtle dark:bg-danger-dark-subtle
			border-danger dark:border-danger-dark
			text-danger dark:text-danger-dark
		`,
		iconClasses: 'text-danger dark:text-danger-dark',
	},
};

export function Alert({
	variant = 'info',
	title,
	children,
	onClose,
	className = '',
}: AlertProps) {
	const config = variantConfig[variant];
	const Icon = config.icon;

	return (
		<div
			className={`
				rounded-lg border p-4
				${config.classes}
				${className}
			`}
		>
			<div className="flex items-start gap-3">
				<Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconClasses}`} />

				<div className="flex-1 min-w-0">
					{title && (
						<h4 className="font-semibold mb-1 text-sm">
							{title}
						</h4>
					)}
					<div className="text-sm opacity-90">
						{children}
					</div>
				</div>

				{onClose && (
					<button
						onClick={onClose}
						className="flex-shrink-0 p-1 hover:opacity-70 transition-opacity"
						aria-label="Close alert"
					>
						<X className="w-4 h-4" />
					</button>
				)}
			</div>
		</div>
	);
}

