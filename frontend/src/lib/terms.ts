import { useSyncExternalStore } from "react";

/**
 * The Terms of Use version. Change it whenever the terms change: everyone is asked to accept again
 * before their next transaction or payment.
 */
export const TERMS_UPDATED = "October 16, 2026";
const TERMS_VERSION = "2026-10-16.2";
const STORAGE_KEY = "muri-terms-accepted";

type Prompt = { resolve: (accepted: boolean) => void } | null;

// Accepted in this session even when storage is blocked (private mode).
let acceptedInMemory = false;
let prompt: Prompt = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function hasAcceptedTerms() {
	if (acceptedInMemory) return true;
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { version?: string } | null;
		return saved?.version === TERMS_VERSION;
	} catch {
		return false;
	}
}

function settle(accepted: boolean) {
	if (accepted) {
		acceptedInMemory = true;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: TERMS_VERSION, at: new Date().toISOString() }));
		} catch {
			// Remembered for this session only.
		}
	}
	prompt?.resolve(accepted);
	prompt = null;
	emit();
}

export const acceptTerms = () => settle(true);
export const declineTerms = () => settle(false);

/**
 * Resolves true once the user has accepted the current terms, asking first if they haven't.
 * Call before anything that sends a transaction or a payment.
 */
export function requireTerms(): Promise<boolean> {
	if (hasAcceptedTerms()) return Promise.resolve(true);
	// A second caller while the dialog is open gets the same answer.
	if (prompt) {
		const pending = prompt;
		return new Promise((resolve) => {
			const original = pending.resolve;
			pending.resolve = (accepted) => {
				original(accepted);
				resolve(accepted);
			};
		});
	}
	return new Promise((resolve) => {
		prompt = { resolve };
		emit();
	});
}

export function useTermsPromptOpen() {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => prompt !== null
	);
}
