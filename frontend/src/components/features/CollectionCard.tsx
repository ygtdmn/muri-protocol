import { FileText, Layers } from 'lucide-react';
import type { Address } from 'viem';

interface CollectionCardProps {
	address: Address;
	name?: string;
	type: 'ERC721' | 'ERC1155' | 'Unknown';
	onClick: () => void;
	isDarkMode: boolean;
}

export function CollectionCard({
	address,
	name,
	type,
	onClick,
	isDarkMode,
}: CollectionCardProps) {
	const TypeIcon = type === 'ERC721' ? FileText : Layers;

	return (
		<button
			onClick={onClick}
			className={`
				group
				w-full p-6 rounded-lg text-left
				border transition-all duration-200
				${
					isDarkMode
						? 'bg-surface-dark border-border-dark hover:bg-surface-hover-dark hover:border-border-hover-dark'
						: 'bg-surface-light border-border-light hover:bg-surface-hover-light hover:border-border-hover-light shadow-soft hover:shadow-medium'
				}
			`}
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-2">
						<h3
							className={`
								font-semibold truncate
								${isDarkMode ? 'text-text-primary-dark' : 'text-text-primary-light'}
							`}
						>
							{name || 'Unnamed Collection'}
						</h3>
						<span
							className={`
								px-2 py-0.5 text-xs font-medium rounded-full
								${
									isDarkMode
										? 'bg-primary-dark-subtle text-primary-dark'
										: 'bg-primary-subtle text-primary'
								}
							`}
						>
							{type}
						</span>
					</div>
					<p
						className={`
							text-sm font-mono truncate
							${isDarkMode ? 'text-text-tertiary-dark' : 'text-text-tertiary-light'}
						`}
					>
						{address}
					</p>
				</div>

				<div
					className={`
						p-2 rounded-lg transition-transform duration-200 group-hover:scale-110
						${
							isDarkMode
								? 'bg-surface-hover-dark text-text-secondary-dark'
								: 'bg-surface-hover-light text-text-secondary-light'
						}
					`}
				>
					<TypeIcon className="w-5 h-5" />
				</div>
			</div>
		</button>
	);
}

