import { http } from "wagmi";
import { mainnet, sepolia, base } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const chains = [mainnet, sepolia, base] as const;

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as
	| string
	| undefined;

export const wagmiConfig = getDefaultConfig({
	appName: "MURI Protocol",
	projectId: projectId ?? "",
	chains,
	transports: {
		[mainnet.id]: http(),
		[sepolia.id]: http(),
		[base.id]: http(),
	},
	ssr: false,
});

// Declaration merging for better type inference across the app
declare module "wagmi" {
	interface Register {
		config: typeof wagmiConfig;
	}
}
