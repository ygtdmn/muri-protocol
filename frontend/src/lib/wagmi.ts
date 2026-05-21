import { fallback, http } from "viem";
import { mainnet, sepolia, base } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const chains = [mainnet, sepolia, base] as const;

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as
	| string
	| undefined;

const mainnetTransport = fallback([
	http("https://eth.llamarpc.com"),
	http("https://ethereum-rpc.publicnode.com"),
	http("https://1rpc.io/eth"),
	http("https://rpc.mevblocker.io"),
	http("https://rpc.flashbots.net"),
	http("https://eth.meowrpc.com"),
	http("https://eth.drpc.org"),
	http("https://eth.merkle.io"),
	http("https://endpoints.omniatech.io/v1/eth/mainnet/public"),
	http("https://0xrpc.io/eth"),
	http("https://rpc.payload.de"),
	http("https://rpc.public.curie.radiumblock.co/http/ethereum"),
	http("https://eth.blockrazor.xyz"),
]);

const sepoliaTransport = fallback([
	http("https://ethereum-sepolia-rpc.publicnode.com"),
	http("https://sepolia.drpc.org"),
	http("https://rpc.sepolia.org"),
	http("https://rpc2.sepolia.org"),
	http("https://1rpc.io/sepolia"),
	http(),
]);

export const wagmiConfig = getDefaultConfig({
	appName: "MURI Protocol",
	projectId: projectId ?? "",
	chains,
	transports: {
		[mainnet.id]: mainnetTransport,
		[sepolia.id]: sepoliaTransport,
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
