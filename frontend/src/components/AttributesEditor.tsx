import type { Attribute } from "../lib/muri";
import { Button, Input } from "./ui";

export default function AttributesEditor({
	attributes,
	onChange,
}: {
	attributes: Attribute[];
	onChange: (next: Attribute[]) => void;
}) {
	const update = (index: number, patch: Partial<Attribute>) =>
		onChange(attributes.map((a, i) => (i === index ? { ...a, ...patch } : a)));

	return (
		<div className="flex flex-col gap-3">
			<span className="micro text-muted">Properties</span>
			{attributes.map((attr, i) => (
				<div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
					<Input
						aria-label={`Property ${i + 1} name`}
						placeholder="Trait"
						value={attr.trait_type}
						onChange={(e) => update(i, { trait_type: e.target.value })}
					/>
					<Input
						aria-label={`Property ${i + 1} value`}
						placeholder="Value"
						value={attr.value}
						onChange={(e) => update(i, { value: e.target.value })}
					/>
					<button
						type="button"
						aria-label={`Remove property ${i + 1}`}
						onClick={() => onChange(attributes.filter((_, j) => j !== i))}
						className="w-11 h-11 grid place-items-center text-muted hover:text-signal transition-colors"
					>
						×
					</button>
				</div>
			))}
			<div>
				<Button
					size="sm"
					variant="ghost"
					onClick={() => onChange([...attributes, { trait_type: "", value: "" }])}
				>
					+ Add property
				</Button>
			</div>
		</div>
	);
}
