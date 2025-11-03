import { Github } from "lucide-react";

interface FooterProps {
	isDarkMode: boolean;
}

export default function Footer({ isDarkMode }: FooterProps) {
	return (
		<footer
			className={`
				border-t backdrop-blur-sm
				${
					isDarkMode
						? "border-border-dark bg-bg-dark/50"
						: "border-border-light bg-bg-light/50"
				}
			`}
		>
			<div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8">
				<div className="flex flex-col md:flex-row items-center justify-between gap-4">
					<p
						className={`
							text-sm
							${
								isDarkMode 
									? "text-text-secondary-dark" 
									: "text-text-secondary-light"
							}
						`}
					>
						Built by{" "}
						<a
							href="https://x.com/yigitduman"
							target="_blank"
							rel="noopener noreferrer"
							className={`
								font-medium transition-colors
								${
									isDarkMode
										? "text-text-primary-dark hover:text-primary-dark"
										: "text-text-primary-light hover:text-primary"
								}
							`}
						>
							Yigit Duman
						</a>
						{" "}and the{" "}
						<a
							href="https://discord.gg/VmjjHSyWJ8"
							target="_blank"
							rel="noopener noreferrer"
							className={`
								font-medium transition-colors
								${
									isDarkMode
										? "text-text-primary-dark hover:text-primary-dark"
										: "text-text-primary-light hover:text-primary"
								}
							`}
						>
							Pushers
						</a>
						{" "}community
					</p>
					
					<div className="flex items-center gap-6">
						<a
							href="https://github.com/ygtdmn/muri-protocol"
							target="_blank"
							rel="noopener noreferrer"
							className={`
								flex items-center gap-2
								text-sm font-medium
								transition-colors
								${
									isDarkMode
										? "text-text-secondary-dark hover:text-text-primary-dark"
										: "text-text-secondary-light hover:text-text-primary-light"
								}
							`}
						>
							<Github className="w-4 h-4" />
							<span>GitHub</span>
						</a>
						
						<a
							href="https://github.com/ygtdmn/muri-protocol/blob/main/LICENSE.md"
							target="_blank"
							rel="noopener noreferrer"
							className={`
								text-sm
								transition-colors
								${
									isDarkMode
										? "text-text-tertiary-dark hover:text-text-secondary-dark"
										: "text-text-tertiary-light hover:text-text-secondary-light"
								}
							`}
						>
							MIT License
						</a>
					</div>
				</div>
			</div>
		</footer>
	);
}
