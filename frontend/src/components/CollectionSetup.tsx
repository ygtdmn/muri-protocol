import type { Address } from "viem";
import { ierc721CreatorCoreAbi } from "../abis/IERC721CreatorCore-abi";
import { ierc1155CreatorCoreAbi } from "../abis/IERC1155CreatorCore-abi";
import { muriAbi } from "../abis/muri-abi";
import { useMuriTransaction } from "../hooks/useMuriTransaction";
import { MURI_ADDRESS, MURI_EXTENSION_ADDRESS } from "../lib/muri";
import type { CollectionType } from "../lib/muri";
import { TxFeedback } from "./TxFeedback";
import { Button, StatusLabel } from "./ui";

/** The two one-time transactions a Manifold collection needs before minting with MURI. */
export default function CollectionSetup({
	creator,
	type,
	extensionRegistered,
	contractRegistered,
	onChanged,
}: {
	creator: Address;
	type: CollectionType;
	extensionRegistered: boolean;
	contractRegistered: boolean;
	onChanged: () => void;
}) {
	const tx = useMuriTransaction(() => onChanged());

	const steps = [
		{
			id: "extension",
			title: "Register the MURI extension",
			body: "Lets the MURI extension mint into your Manifold Creator Core.",
			done: extensionRegistered,
			run: () =>
				type === "ERC721"
					? tx.run("extension", {
							abi: ierc721CreatorCoreAbi,
							address: creator,
							functionName: "registerExtension",
							args: [MURI_EXTENSION_ADDRESS, ""],
						})
					: tx.run("extension", {
							abi: ierc1155CreatorCoreAbi,
							address: creator,
							functionName: "registerExtension",
							args: [MURI_EXTENSION_ADDRESS, ""],
						}),
		},
		{
			id: "contract",
			title: "Register the collection with MURI",
			body: "Records the collection in the MURI contract so tokens can store multiple URIs.",
			done: contractRegistered,
			run: () =>
				tx.run("contract", {
					abi: muriAbi,
					address: MURI_ADDRESS,
					functionName: "registerContract",
					args: [creator, MURI_EXTENSION_ADDRESS],
				}),
		},
	];

	return (
		<ol className="flex flex-col border-t border-line">
			{steps.map((step, i) => (
				<li key={step.id} className="border-b border-line py-5 flex flex-col gap-3">
					<div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
						<div className="flex gap-4">
							<span className="micro text-faint tabular-nums pt-[5px]">0{i + 1}</span>
							<div className="flex flex-col gap-1">
								<span className="font-medium">{step.title}</span>
								<span className="text-[13px] text-muted">{step.body}</span>
							</div>
						</div>
						<div className="pl-8 sm:pl-0 shrink-0">
							{step.done ? (
								<StatusLabel tone="up">Done</StatusLabel>
							) : (
								<Button
									size="sm"
									onClick={() => void step.run()}
									disabled={tx.busy}
									loading={tx.busy && tx.state.action === step.id}
								>
									Register
								</Button>
							)}
						</div>
					</div>
					<div className="pl-8">
						<TxFeedback state={tx.state} action={step.id} successMessage="Registered." />
					</div>
				</li>
			))}
		</ol>
	);
}
