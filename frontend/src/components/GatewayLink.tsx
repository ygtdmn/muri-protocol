import { toGatewayUrl, useLinkProbes } from "../hooks/useLinkHealth";
import { hostOf } from "../lib/uri";

/** Links a URI through the first gateway that serves it (ar:// and ipfs:// have several). */
export default function GatewayLink({ uri, className = "" }: { uri: string; className?: string }) {
	const [probe] = useLinkProbes([uri]);
	const href = probe.url && probe.health === "live" ? probe.url : toGatewayUrl(uri);
	const via = probe.health === "live" && !/^https?:/i.test(uri) ? hostOf(probe.url) : undefined;
	if (!href) return <span className={className}>{uri}</span>;
	return (
		<a href={href} target="_blank" rel="noopener noreferrer" className={className}>
			{uri}
			{via && <span className="text-faint"> · via {via}</span>}
		</a>
	);
}
