import { ConnectButton } from "@rainbow-me/rainbowkit";

interface ConnectButtonHeaderProps {
	isDarkMode: boolean;
}

export default function ConnectButtonHeader({ isDarkMode }: ConnectButtonHeaderProps) {
	return (
		<ConnectButton.Custom>
			{({
				account,
				chain,
				openAccountModal,
				openChainModal,
				openConnectModal,
				authenticationStatus,
				mounted,
			}) => {
				const ready = mounted && authenticationStatus !== "loading";
				const connected =
					ready &&
					account &&
					chain &&
					(!authenticationStatus ||
						authenticationStatus === "authenticated");

				return (
					<div
						{...(!ready && {
							"aria-hidden": true,
							style: {
								opacity: 0,
								pointerEvents: "none",
								userSelect: "none",
							},
						})}
					>
						{(() => {
							if (!connected) {
								return (
									<button
										onClick={openConnectModal}
										type="button"
										className={`
											px-3 py-1.5 text-sm rounded-md
											border font-medium
											transition-all duration-200
											${
												isDarkMode
													? "border-border-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-border-hover-dark"
													: "border-border-light text-text-secondary-light hover:text-text-primary-light hover:border-border-hover-light"
											}
										`}
									>
										Connect
									</button>
								);
							}

							if (chain.unsupported) {
								return (
									<button
										onClick={openChainModal}
										type="button"
										className="
											px-3 py-1.5 text-sm rounded-md
											border border-danger
											text-danger hover:text-danger-dark
											font-medium transition-all duration-200
										"
									>
										Wrong network
									</button>
								);
							}

							return (
								<div className="flex gap-2">
									<button
										onClick={openChainModal}
										className={`
											px-3 py-1.5 text-sm rounded-md
											border font-medium
											transition-all duration-200
											${
												isDarkMode
													? "border-border-dark text-text-secondary-dark hover:text-text-primary-dark hover:bg-surface-hover-dark"
													: "border-border-light text-text-secondary-light hover:text-text-primary-light hover:bg-surface-hover-light"
											}
										`}
										type="button"
									>
										{chain.name}
									</button>

									<button
										onClick={openAccountModal}
										type="button"
										className="
											px-3 py-1.5 text-sm rounded-md
											bg-primary hover:bg-primary-hover
											dark:bg-primary-dark dark:hover:bg-primary-dark-hover
											text-white font-medium
											shadow-soft hover:shadow-medium
											transition-all duration-200
										"
									>
										{account.displayName}
									</button>
								</div>
							);
						})()}
					</div>
				);
			}}
		</ConnectButton.Custom>
	);
}
