import { useState } from 'react';
import type { ReactNode } from 'react';

export interface TooltipProps {
	content: ReactNode;
	children: ReactNode;
	position?: 'top' | 'bottom' | 'left' | 'right';
	className?: string;
}

const positionClasses = {
	top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
	bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
	left: 'right-full top-1/2 -translate-y-1/2 mr-2',
	right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({
	content,
	children,
	position = 'top',
	className = '',
}: TooltipProps) {
	const [isVisible, setIsVisible] = useState(false);

	return (
		<div
			className="relative inline-block"
			onMouseEnter={() => setIsVisible(true)}
			onMouseLeave={() => setIsVisible(false)}
			onFocus={() => setIsVisible(true)}
			onBlur={() => setIsVisible(false)}
		>
			{children}

			{isVisible && (
				<div
					className={`
						absolute z-50
						${positionClasses[position]}
						${className}
					`}
				>
					<div
						className="
							px-3 py-2
							bg-text-primary-light dark:bg-text-primary-dark
							text-surface-light dark:text-surface-dark
							text-sm rounded-md
							shadow-medium
							whitespace-nowrap
							max-w-xs
							animate-fade-in
						"
					>
						{content}
					</div>
				</div>
			)}
		</div>
	);
}

