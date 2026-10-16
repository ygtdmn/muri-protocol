import { createConnector } from "wagmi";
import { baseAccount } from "wagmi/connectors";

type BaseParams = Parameters<typeof baseAccount>[0];
type Listener = (...args: never[]) => void;

/**
 * wagmi's Base Account connector, named "Base", with a quieter reconnect.
 *
 * On every page load wagmi's `reconnect` walks all connectors, and the stock Base Account
 * connector answers `connect({ isReconnecting: true })` with a fresh `wallet_connect` request.
 * The Base SDK sends that through its popup, so any browser holding a Base session (even one where
 * the user connected a different wallet) gets a popup on load.
 *
 * Here reconnects read the session the SDK already persisted (`eth_accounts` and `eth_chainId`
 * are answered locally), and the popup only opens when the user actually picks Base.
 * Ported from the Normies site.
 */
export function baseWallet(params: BaseParams) {
	const createBase = baseAccount(params);

	return createConnector((config) => {
		const base = createBase(config);
		let listeners: Record<string, Listener> | undefined;

		async function detach(connector: { getProvider: () => Promise<unknown> }) {
			if (!listeners) return;
			const provider = (await connector.getProvider()) as unknown as {
				removeListener: (event: string, listener: Listener) => void;
			};
			for (const [event, listener] of Object.entries(listeners)) provider.removeListener(event, listener);
			listeners = undefined;
		}

		const connector: ReturnType<typeof createBase> = {
			...base,
			name: "Base",
			async connect(parameters) {
				if (!parameters?.isReconnecting) return base.connect.call(this, parameters) as never;

				const accounts = await this.getAccounts();
				if (!accounts.length) throw new Error("Base has no stored session");
				const chainId = await this.getChainId();

				if (!listeners) {
					const provider = (await this.getProvider()) as unknown as {
						on: (event: string, listener: Listener) => void;
					};
					listeners = {
						accountsChanged: this.onAccountsChanged.bind(this) as Listener,
						chainChanged: this.onChainChanged.bind(this) as Listener,
						disconnect: this.onDisconnect.bind(this) as Listener,
					};
					for (const [event, listener] of Object.entries(listeners)) provider.on(event, listener);
				}

				return {
					accounts: (parameters.withCapabilities
						? accounts.map((address) => ({ address, capabilities: {} }))
						: accounts) as never,
					chainId,
				} as never;
			},
			async disconnect() {
				await detach(this);
				return base.disconnect.call(this);
			},
			async onDisconnect(error) {
				await detach(this);
				return base.onDisconnect.call(this, error);
			},
		};
		return connector;
	});
}
