export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "Unknown error";
}

export function isRpcTransportError(error: unknown): boolean {
	const message = getErrorMessage(error).toLowerCase();
	return [
		"failed to fetch",
		"http request failed",
		"cors",
		"429",
		"rate limit",
		"timeout",
		"timed out",
		"networkerror",
		"network error",
		"load failed",
	].some((fragment) => message.includes(fragment));
}

export function getPreflightMessage(error: unknown): string {
	const message = getErrorMessage(error);
	if (isRpcTransportError(error)) {
		return `RPC preflight check failed (${message.split("\n")[0]}). Continuing with the wallet transaction because this is a transport error, not a contract revert.`;
	}
	return `Transaction will fail: ${message}`;
}
