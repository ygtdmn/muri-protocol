import type { ReactNode } from 'react';

interface PageBackgroundProps {
	isDarkMode: boolean;
	children: ReactNode;
	className?: string;
}

export default function PageBackground({ isDarkMode, children, className = '' }: PageBackgroundProps) {
	return (
		<div
			className={`${className}`}
			style={{
				backgroundColor: isDarkMode ? '#0F0F0F' : '#FEFEFE',
				backgroundImage: isDarkMode 
					? `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0)`
					: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)`,
				backgroundSize: '20px 20px'
			}}
		>
			{children}
		</div>
	);
}

