import { useEffect, useRef, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { simulateContract } from "wagmi/actions";
import type { Address } from "viem";
import { muriAbi } from "../abis/muri-abi";
import { wagmiConfig } from "../lib/wagmi";
import { useTheme } from "../hooks/useTheme";
import { RefreshCw } from "lucide-react";
import { getPreflightMessage, isRpcTransportError } from "../utils/rpcErrors";

interface RegisterMURIProps {
	creator: Address;
	isRegistered: boolean;
	onSuccess?: () => void;
}

export default function RegisterMURI({
	creator,
	isRegistered,
	onSuccess,
}: RegisterMURIProps) {
	const { isDarkMode } = useTheme();
	const muriAddress = import.meta.env.VITE_MURI_ADDRESS as Address;
	const muriExtensionAddress = import.meta.env
		.VITE_MURI_EXTENSION_ADDRESS as Address;

	const { data: hash, isPending, writeContract } = useWriteContract();
	const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
		hash,
	});
	const [isPreflighting, setIsPreflighting] = useState(false);
	const [preflightMessage, setPreflightMessage] = useState<string | null>(null);
	const reportedSuccessHash = useRef<`0x${string}` | undefined>(undefined);

	const handleRegister = async () => {
		setPreflightMessage(null);
		setIsPreflighting(true);
		try {
			await simulateContract(wagmiConfig, {
				abi: muriAbi,
				address: muriAddress,
				functionName: "registerContract",
				args: [creator, muriExtensionAddress],
			});
		} catch (error) {
			setPreflightMessage(getPreflightMessage(error));
			if (!isRpcTransportError(error)) {
				return;
			}
		} finally {
			setIsPreflighting(false);
		}

		writeContract({
			abi: muriAbi,
			address: muriAddress,
			functionName: "registerContract",
			args: [creator, muriExtensionAddress],
		});
	};

	// Call onSuccess callback when transaction is successful
	useEffect(() => {
		if (isSuccess && hash && reportedSuccessHash.current !== hash) {
			reportedSuccessHash.current = hash;
			onSuccess?.();
		}
	}, [hash, isSuccess, onSuccess]);

	useEffect(() => {
		setPreflightMessage(null);
	}, [creator]);

	// Show success message for recent transaction
	if (isSuccess) {
		return (
			<div
				className={`
					p-4 rounded-lg
					${
						isDarkMode
							? "bg-success-dark-subtle border border-success-dark/20"
							: "bg-success-subtle border border-success/20"
					}
				`}
			>
				<p
					className={`
						text-sm font-medium
						${isDarkMode ? "text-success-dark" : "text-success"}
					`}
				>
					✓ Contract registered with MURI Protocol successfully!
				</p>
			</div>
		);
	}

	// Show already registered status
	if (isRegistered) {
		return (
			<div
				className={`
					p-4 rounded-lg
					${
						isDarkMode
							? "bg-success-dark-subtle border border-success-dark/20"
							: "bg-success-subtle border border-success/20"
					}
				`}
			>
				<p
					className={`
						text-sm font-medium
						${isDarkMode ? "text-success-dark" : "text-success"}
					`}
				>
					✓ Contract is already registered with MURI Protocol
				</p>
			</div>
		);
	}

	return (
		<div
			className={`
				p-5 rounded-lg
				${
					isDarkMode
						? "bg-surface-hover-dark border border-border-dark"
						: "bg-surface-hover-light border border-border-light"
				}
			`}
		>
			<div className="mb-4">
				<h4
					className={`
						font-semibold text-base mb-1
						${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
					`}
				>
					2. Register with MURI Protocol
				</h4>
				<p
					className={`
						text-sm
						${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
					`}
				>
					This enables multi-URI storage features for your collection
				</p>
			</div>

			<button
				onClick={() => void handleRegister()}
				className={`
					w-full px-6 py-3 rounded-lg font-semibold
					transition-all duration-200
					${
						isPending ||
						isConfirming ||
						isPreflighting ||
						!creator ||
						isRegistered
							? "opacity-50 cursor-not-allowed bg-surface-hover-light dark:bg-surface-hover-dark text-text-tertiary-light dark:text-text-tertiary-dark"
							: "bg-primary hover:bg-primary-hover dark:bg-primary-dark dark:hover:bg-primary-dark-hover text-white shadow-soft hover:shadow-medium"
					}
				`}
				disabled={
					isPending || isConfirming || isPreflighting || !creator || isRegistered
				}
			>
				{isPending || isConfirming || isPreflighting ? (
					<span className="flex items-center justify-center gap-2">
						<RefreshCw className="w-4 h-4 animate-spin" />
						{isPreflighting
							? "Checking..."
							: isPending
							? "Registering..."
							: "Confirming..."}
					</span>
				) : isRegistered ? (
					"✓ Already Registered"
				) : (
					"Register Contract"
				)}
			</button>

			{preflightMessage && (
				<div
					className={`
						mt-3 p-3 rounded-lg
						${
							isDarkMode
								? "bg-warning-dark-subtle border border-warning-dark/30"
								: "bg-warning-subtle border border-warning/30"
						}
					`}
				>
					<p
						className={`
							text-sm font-medium
							${isDarkMode ? "text-warning-dark" : "text-warning"}
						`}
					>
						{preflightMessage}
					</p>
				</div>
			)}

			{hash && !isSuccess && (
				<p
					className={`
						text-sm mt-2
						${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
					`}
				>
					Transaction submitted. Waiting for confirmation...
				</p>
			)}
		</div>
	);
}
