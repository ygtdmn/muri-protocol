import { Loader2 } from 'lucide-react';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface SpinnerProps {
	size?: SpinnerSize;
	className?: string;
	label?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
	sm: 'w-4 h-4',
	md: 'w-6 h-6',
	lg: 'w-8 h-8',
	xl: 'w-12 h-12',
};

export function Spinner({ size = 'md', className = '', label }: SpinnerProps) {
	return (
		<div className="flex flex-col items-center justify-center gap-3">
			<Loader2
				className={`
					animate-spin
					text-primary dark:text-primary-dark
					${sizeClasses[size]}
					${className}
				`}
			/>
			{label && (
				<p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
					{label}
				</p>
			)}
		</div>
	);
}

