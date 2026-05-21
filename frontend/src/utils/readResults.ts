type SuccessfulRead<T> = {
	status: "success";
	result: T;
};

type FailedRead = {
	status: "failure";
	error: Error;
};

export function readResult<T>(entry: unknown): T | undefined {
	if (
		typeof entry === "object" &&
		entry !== null &&
		"status" in entry &&
		entry.status === "success" &&
		"result" in entry
	) {
		return (entry as SuccessfulRead<T>).result;
	}
	return undefined;
}

export function readError(entry: unknown): Error | undefined {
	if (
		typeof entry === "object" &&
		entry !== null &&
		"status" in entry &&
		entry.status === "failure" &&
		"error" in entry
	) {
		return (entry as FailedRead).error;
	}
	return undefined;
}
