import { Link } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import ConnectButtonHeader from "./ConnectButtonHeader";

interface HeaderProps {
	isDarkMode: boolean;
	toggleTheme: () => void;
	hideConnectButton?: boolean;
}

export default function Header({ isDarkMode, toggleTheme, hideConnectButton }: HeaderProps) {
	return (
		<nav
			className={`
				sticky top-0 z-40 
				backdrop-blur-md bg-opacity-80
				border-b
				${
					isDarkMode
						? "border-border-dark bg-bg-dark/80"
						: "border-border-light bg-bg-light/80"
				}
			`}
		>
			<div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-4 flex items-center justify-between">
				<Link
					to="/"
					className={`
						text-xl font-bold tracking-tight
						transition-colors
						${
							isDarkMode 
								? "text-text-primary-dark hover:text-primary-dark" 
								: "text-text-primary-light hover:text-primary"
						}
					`}
				>
					Wayfinder
				</Link>
				
				<div className="flex items-center gap-3">
					<button
						onClick={toggleTheme}
						className={`
							p-2 rounded-md
							transition-all duration-200
							${
								isDarkMode
									? "hover:bg-surface-hover-dark text-text-secondary-dark hover:text-text-primary-dark"
									: "hover:bg-surface-hover-light text-text-secondary-light hover:text-text-primary-light"
							}
						`}
						aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
					>
						{isDarkMode ? (
							<Sun className="w-5 h-5" />
						) : (
							<Moon className="w-5 h-5" />
						)}
					</button>
					{!hideConnectButton && <ConnectButtonHeader isDarkMode={isDarkMode} />}
				</div>
			</div>
		</nav>
	);
}
