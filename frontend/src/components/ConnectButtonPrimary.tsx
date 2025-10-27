import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function ConnectButtonPrimary() {
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
										className="
											px-6 py-2.5 rounded-md
											bg-primary hover:bg-primary-hover
											dark:bg-primary-dark dark:hover:bg-primary-dark-hover
											text-white font-medium
											shadow-soft hover:shadow-medium
											transition-all duration-200
											focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
										"
									>
										Connect Wallet
									</button>
								);
							}

							if (chain.unsupported) {
								return (
									<button
										onClick={openChainModal}
										type="button"
										className="
											px-6 py-2.5 rounded-md
											bg-danger hover:bg-danger-dark
											text-white font-medium
											shadow-soft hover:shadow-medium
											transition-all duration-200
										"
									>
										Wrong Network
									</button>
								);
							}

							return (
								<div className="flex gap-2">
									<button
										onClick={openChainModal}
										className="
											px-4 py-2 rounded-md text-sm
											bg-surface-light hover:bg-surface-hover-light
											dark:bg-surface-dark dark:hover:bg-surface-hover-dark
											text-text-primary-light dark:text-text-primary-dark
											border border-border-light dark:border-border-dark
											transition-all duration-200
										"
										type="button"
									>
										{chain.name}
									</button>

									<button
										onClick={openAccountModal}
										type="button"
										className="
											px-4 py-2 rounded-md text-sm
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
