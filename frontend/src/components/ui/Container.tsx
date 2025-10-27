import { ReactNode } from 'react';

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ContainerProps {
	children: ReactNode;
	size?: ContainerSize;
	className?: string;
}

const sizeClasses: Record<ContainerSize, string> = {
	sm: 'max-w-2xl',
	md: 'max-w-4xl',
	lg: 'max-w-6xl',
	xl: 'max-w-7xl',
	full: 'max-w-full',
};

export function Container({
	children,
	size = 'lg',
	className = '',
}: ContainerProps) {
	return (
		<div
			className={`
				mx-auto px-4 md:px-6 lg:px-8 w-full
				${sizeClasses[size]}
				${className}
			`}
		>
			{children}
		</div>
	);
}

