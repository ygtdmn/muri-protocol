import { fallback, http } from "viem";
import { createConfig, injected } from "wagmi";
import { metaMask, walletConnect } from "wagmi/connectors";
import { mainnet, sepolia, base } from "wagmi/chains";
import { baseWallet } from "./baseWallet";

export const chains = [mainnet, base, sepolia] as const;

/** WalletConnect's project id; without one the WalletConnect option is hidden. */
export const WC_PROJECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ?? "";

const APP_NAME = "MURI Protocol";
// What wallets show in their connect prompts: the live origin, so previews and local dev are honest.
const appUrl = window.location.origin;
const appIcon = `${appUrl}/icon.png`;

// Checked for eth_call and eth_estimateGas against MURI. Dead or method-restricted endpoints are left
// out: viem's fallback walks the list in order, and a dead entry turns a clear error into a vague one.
// Sepolia lists Tenderly and thirdweb first: they simulate up to the full block gas limit, where
// publicnode stops at 50M and reports the shortfall as a revert.
export const RPC_URLS: Record<(typeof chains)[number]["id"], readonly string[]> = {
	[mainnet.id]: [
		"https://ethereum-rpc.publicnode.com",
		"https://mainnet.gateway.tenderly.co",
		"https://1.rpc.thirdweb.com",
		"https://1rpc.io/eth",
		"https://rpc.mevblocker.io",
		"https://eth.drpc.org",
		"https://0xrpc.io/eth",
		"https://eth.blockrazor.xyz",
	],
	[base.id]: [
		"https://base-rpc.publicnode.com",
		"https://mainnet.base.org",
		"https://base.gateway.tenderly.co",
		"https://8453.rpc.thirdweb.com",
		"https://base.drpc.org",
	],
	[sepolia.id]: [
		"https://sepolia.gateway.tenderly.co",
		"https://11155111.rpc.thirdweb.com",
		"https://ethereum-sepolia-rpc.publicnode.com",
	],
};

const transport = (urls: readonly string[]) => fallback(urls.map((url) => http(url)));

/**
 * The wallets behind our own connect modal (components/wallet/ConnectModal.tsx), as on the Normies
 * site: MetaMask through its SDK (the extension when installed, else a pairing link drawn as a QR),
 * Base through `baseWallet`, WalletConnect with its own QR modal off (we draw the QR), and the
 * generic injected wallet. Rabby, Phantom and other extensions arrive by EIP-6963 discovery, each as
 * a connector whose id is its rdns.
 */
export const wagmiConfig = createConfig({
	chains,
	transports: {
		[mainnet.id]: transport(RPC_URLS[mainnet.id]),
		[sepolia.id]: transport(RPC_URLS[sepolia.id]),
		[base.id]: transport(RPC_URLS[base.id]),
	},
	multiInjectedProviderDiscovery: true,
	connectors: [
		metaMask({
			dapp: { name: APP_NAME, url: appUrl, iconUrl: appIcon },
			ui: { headless: true, preferExtension: true },
		}),
		// Base's SDK sends its own telemetry by default; the app needs none of it.
		baseWallet({ appName: APP_NAME, appLogoUrl: appIcon, preference: { telemetry: false } }),
		...(WC_PROJECT_ID
			? [
					walletConnect({
						projectId: WC_PROJECT_ID,
						showQrModal: false,
						metadata: { name: APP_NAME, description: "Multiple URIs for any NFT", url: appUrl, icons: [appIcon] },
					}),
				]
			: []),
		injected(),
	],
});

// Declaration merging for better type inference across the app
declare module "wagmi" {
	interface Register {
		config: typeof wagmiConfig;
	}
}
