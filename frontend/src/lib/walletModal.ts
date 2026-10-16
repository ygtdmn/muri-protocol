import { useSyncExternalStore } from "react";

// Whether the connect modal is open. A module store so any button can open it without props.
let open = false;
const listeners = new Set<() => void>();

const set = (next: boolean) => {
	open = next;
	for (const l of listeners) l();
};

export const openConnectModal = () => set(true);
export const closeConnectModal = () => set(false);

export function useConnectModalOpen() {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => open
	);
}
