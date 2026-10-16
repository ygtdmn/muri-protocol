import { useState, useEffect } from "react";
import { useConnection, useSignMessage } from "wagmi";

const CLIENT_ID = import.meta.env.VITE_MANIFOLD_CLIENT_ID || "";
const APP_NAME = import.meta.env.VITE_MANIFOLD_APP_NAME || "";

// The Manifold tokens live in sessionStorage: readable only by this tab's scripts, never sent along
// with requests the way cookies are, and gone when the tab closes.
const STORAGE_KEY = "muri-manifold-auth";
const LIFETIME_MS = 60 * 60 * 1000;

interface StoredAuth {
	accessToken: string;
	sessionToken: string;
	address: string;
	expiresAt: number;
}

function readAuth(): StoredAuth | null {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const auth = JSON.parse(raw) as StoredAuth;
		return auth.expiresAt > Date.now() ? auth : null;
	} catch {
		return null;
	}
}

function writeAuth(auth: StoredAuth | null) {
	try {
		if (auth) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
		else sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		// Storage blocked: the session just won't survive a reload.
	}
}

// Earlier versions kept these in cookies, sent with every request to this site. Clear them out.
for (const name of ["manifold_access_token", "manifold_session_token", "manifold_expires_at", "manifold_wallet_address", "manifold_chain_id"]) {
	document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export function useManifoldAuth() {
	const { address, chainId } = useConnection();
	const { mutateAsync: signMessageAsync } = useSignMessage();
	const [auth, setAuth] = useState<StoredAuth | null>(readAuth);
	const [isAuthenticating, setIsAuthenticating] = useState(false);

	// A session belongs to one wallet; switching or disconnecting ends it.
	useEffect(() => {
		const current = readAuth();
		if (!address || (current && current.address.toLowerCase() !== address.toLowerCase())) {
			writeAuth(null);
			setAuth(null);
			return;
		}
		setAuth(current);
	}, [address]);

	// Drop the session the moment it expires, so the UI offers to sign in again instead of failing.
	useEffect(() => {
		if (!auth) return;
		const timer = setTimeout(() => {
			writeAuth(null);
			setAuth(null);
		}, Math.max(0, auth.expiresAt - Date.now()));
		return () => clearTimeout(timer);
	}, [auth]);

	// Expired sessions never get here: readAuth drops them and the timer above clears them on time.
	const valid = Boolean(auth && address && auth.address.toLowerCase() === address.toLowerCase());

	const authenticate = async () => {
		if (!address || !chainId || isAuthenticating) return;
		
		if (valid && auth) return { token: auth.accessToken, session: auth.sessionToken };

		try {
			setIsAuthenticating(true);

			// Generate code verifier and challenge for PKCE
			const codeVerifier = generateCodeVerifier();
			const codeChallenge = await generateCodeChallenge(codeVerifier);

			// Step 1: Get OAuth code
			const authResponse = await fetch("https://oauth2.manifoldxyz.dev/auth", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					address,
					clientId: CLIENT_ID,
					grantType: "signature",
					codeChallenge,
				}),
			});

			const authData = await authResponse.json();
			const oauthCode = authData.oauth_code;

			if (!oauthCode) throw new Error("Failed to get OAuth code");

			// Step 2: Sign the message
			const message = `Please sign this to allow ${APP_NAME} access to view your NFTs.\n\nChallenge: ${oauthCode}`;
			const signature = await signMessageAsync({ message });

			// Step 3: Exchange for access token
			const tokenBody = {
				clientId: CLIENT_ID,
				appName: APP_NAME,
				codeVerifier,
				chainId,
				message,
				code: oauthCode,
				signature,
				grantType: "signature",
			};

			const tokenResponse = await fetch(
				"https://oauth2.manifoldxyz.dev/token",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(tokenBody),
				}
			);

			const tokenData = await tokenResponse.json();
			if (!tokenResponse.ok) {
				// The response can echo credentials, so report only the status and Manifold's message.
				throw new Error(`Manifold sign-in failed (${tokenResponse.status})${tokenData?.error ? `: ${tokenData.error}` : ""}`);
			}

			const accessToken = tokenData.access_token;
			if (!accessToken) throw new Error("Failed to get access token");

			// Step 4: Exchange for session token (required by Studio API)
			const sessionResponse = await fetch(
				"https://studio.api.manifoldxyz.dev/auth/1/login",
				{
					method: "POST",
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
						Authorization: `Bearer ${accessToken}`,
					},
					body: JSON.stringify({}),
				}
			);
			const sessionData = await sessionResponse.json();
			if (!sessionResponse.ok) {
				// Handle specific "User not found" error with friendly message
				if (sessionResponse.status === 400 && sessionData.error === "User not found") {
					throw new Error("User not registered with Manifold. Please register at studio.manifold.xyz first.");
				}
				throw new Error(`Manifold session failed (${sessionResponse.status})${sessionData?.error ? `: ${sessionData.error}` : ""}`);
			}
			const sessionToken = sessionData.token as string;
			if (!sessionToken) throw new Error("Failed to get session token");

			const next = { accessToken, sessionToken, address, expiresAt: Date.now() + LIFETIME_MS };
			writeAuth(next);
			setAuth(next);
			return { token: accessToken, session: sessionToken };
		} finally {
			setIsAuthenticating(false);
		}
	};

	const logout = () => {
		writeAuth(null);
		setAuth(null);
	};

	return {
		token: valid && auth ? auth.accessToken : "",
		session: valid && auth ? auth.sessionToken : "",
		isAuthenticated: valid,
		isAuthenticating,
		authenticate,
		logout,
	};
}

// PKCE helpers
function generateCodeVerifier() {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return btoa(String.fromCharCode(...array))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}

async function generateCodeChallenge(verifier: string) {
	const encoder = new TextEncoder();
	const data = encoder.encode(verifier);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return btoa(String.fromCharCode(...new Uint8Array(digest)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}
