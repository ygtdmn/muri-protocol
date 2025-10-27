import { useEffect } from "react";
import {
	useWriteContract,
	useWaitForTransactionReceipt,
	useReadContract,
	useSimulateContract,
} from "wagmi";
import type { Address } from "viem";
import { wayfinderAbi } from "../abis/wayfinder-abi";
import { useTheme } from "../hooks/useTheme";
import { RefreshCw } from "lucide-react";

interface RegisterWayfinderProps {
	creator: Address;
	onSuccess?: () => void;
}

export default function RegisterWayfinder({ creator, onSuccess }: RegisterWayfinderProps) {
	const { isDarkMode } = useTheme();
	const wayfinderAddress = import.meta.env.VITE_WAYFINDER_ADDRESS as Address;
	const wayfinderExtensionAddress = import.meta.env
		.VITE_WAYFINDER_EXTENSION_ADDRESS as Address;

	const { data: hash, isPending, writeContract } = useWriteContract();
	const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
		hash,
	});

	// Check if contract is already registered with Wayfinder
	const { data: isRegistered } = useReadContract({
		abi: wayfinderAbi,
		address: wayfinderAddress,
		functionName: "isContractOperator",
		args: [creator, wayfinderExtensionAddress],
		query: { enabled: !!creator },
	});

	// Simulate the registration to catch errors
	const { error: simulateError } = useSimulateContract({
		abi: wayfinderAbi,
		address: wayfinderAddress,
		functionName: "registerContract",
		args: [creator, wayfinderExtensionAddress],
		query: { enabled: !!creator && !isRegistered },
	});

	const handleRegister = () => {
		writeContract({
			abi: wayfinderAbi,
			address: wayfinderAddress,
			functionName: "registerContract",
			args: [creator, wayfinderExtensionAddress],
		});
	};

	// Call onSuccess callback when transaction is successful
	useEffect(() => {
		if (isSuccess && onSuccess) {
			onSuccess();
		}
	}, [isSuccess, onSuccess]);

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
					✓ Contract registered with Wayfinder successfully!
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
					✓ Contract is already registered with Wayfinder
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
					2. Register with Wayfinder
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
				onClick={handleRegister}
				className={`
					w-full px-6 py-3 rounded-lg font-semibold
					transition-all duration-200
					${
						isPending || isConfirming || !creator || isRegistered || !!simulateError
							? "opacity-50 cursor-not-allowed bg-surface-hover-light dark:bg-surface-hover-dark text-text-tertiary-light dark:text-text-tertiary-dark"
							: "bg-primary hover:bg-primary-hover dark:bg-primary-dark dark:hover:bg-primary-dark-hover text-white shadow-soft hover:shadow-medium"
					}
				`}
				disabled={
					isPending ||
					isConfirming ||
					!creator ||
					isRegistered ||
					!!simulateError
				}
			>
				{isPending || isConfirming ? (
					<span className="flex items-center justify-center gap-2">
						<RefreshCw className="w-4 h-4 animate-spin" />
						{isPending ? "Registering..." : "Confirming..."}
					</span>
				) : isRegistered ? (
					"✓ Already Registered"
				) : (
					"Register Contract"
				)}
			</button>

			{simulateError && (
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
						Transaction will fail: {simulateError.message}
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
