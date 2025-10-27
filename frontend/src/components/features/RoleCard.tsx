import { ReactNode } from 'react';

interface RoleCardProps {
	title: string;
	description: string;
	icon: ReactNode;
	onClick: () => void;
	accentColor: 'primary' | 'secondary';
	isDarkMode: boolean;
}

export function RoleCard({
	title,
	description,
	icon,
	onClick,
	accentColor,
	isDarkMode,
}: RoleCardProps) {
	const colorClasses = {
		primary: {
			iconBg: isDarkMode ? 'bg-primary-dark-subtle' : 'bg-primary-subtle',
			iconColor: isDarkMode ? 'text-primary-dark' : 'text-primary',
			hoverBorder: isDarkMode ? 'group-hover:border-primary-dark' : 'group-hover:border-primary',
		},
		secondary: {
			iconBg: isDarkMode ? 'bg-secondary-dark-subtle' : 'bg-secondary-subtle',
			iconColor: isDarkMode ? 'text-secondary-dark' : 'text-secondary',
			hoverBorder: isDarkMode ? 'group-hover:border-secondary-dark' : 'group:hover:border-secondary',
		},
	};

	const colors = colorClasses[accentColor];

	return (
		<button
			onClick={onClick}
			className={`
				group
				w-full p-8 rounded-xl
				border-2 transition-all duration-200
				${
					isDarkMode
						? 'bg-surface-dark border-border-dark hover:bg-surface-hover-dark'
						: 'bg-surface-light border-border-light hover:bg-surface-hover-light shadow-soft hover:shadow-medium'
				}
				${colors.hoverBorder}
			`}
		>
			<div className="flex flex-col items-center text-center space-y-4">
				<div
					className={`
						w-16 h-16 rounded-xl
						flex items-center justify-center
						transition-all duration-200
						${colors.iconBg}
						group-hover:scale-110
					`}
				>
					<div className={colors.iconColor}>{icon}</div>
				</div>

				<div>
					<h3
						className={`
							text-2xl font-bold mb-2
							${isDarkMode ? 'text-text-primary-dark' : 'text-text-primary-light'}
						`}
					>
						{title}
					</h3>
					<p
						className={`
							leading-relaxed
							${isDarkMode ? 'text-text-secondary-dark' : 'text-text-secondary-light'}
						`}
					>
						{description}
					</p>
				</div>
			</div>
		</button>
	);
}

