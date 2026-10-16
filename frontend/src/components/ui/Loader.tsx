// Three pulsing bars, echoing the MURI mark (one bar per URI).
export function Loader({ className = "" }: { className?: string }) {
	return (
		<span
			role="presentation"
			className={`inline-flex items-end gap-[2px] h-[10px] ${className}`}
		>
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					className="w-[2px] h-full bg-current origin-bottom animate-bar"
					style={{ animationDelay: `${i * 0.15}s` }}
				/>
			))}
		</span>
	);
}

export function LoadingLine({ label }: { label: string }) {
	return (
		<p className="flex items-center gap-3 text-muted" role="status">
			<Loader />
			<span className="micro">{label}</span>
		</p>
	);
}
