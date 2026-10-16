import { useEffect, useState } from "react";
import { getFileInfo } from "../utils/fileValidation";
import { formatBytes } from "../lib/muri";

export default function FilePreview({
	file,
	className = "",
	maxHeight = "max-h-80",
	bare = false,
}: {
	file: File;
	className?: string;
	maxHeight?: string;
	/** Just the media, without the backdrop and the file details. */
	bare?: boolean;
}) {
	const category = getFileInfo(file).category;
	const [url, setUrl] = useState<string>();
	const [html, setHtml] = useState("");

	useEffect(() => {
		const next = URL.createObjectURL(file);
		setUrl(next);
		return () => URL.revokeObjectURL(next);
	}, [file]);

	useEffect(() => {
		if (category !== "html") return;
		let cancelled = false;
		void file.text().then((text) => {
			if (!cancelled) setHtml(text);
		});
		return () => {
			cancelled = true;
		};
	}, [file, category]);

	const stop = (e: React.SyntheticEvent) => e.stopPropagation();

	let body: React.ReactNode;
	switch (category) {
		case "image":
			body = <img src={url} alt="" className={`${maxHeight} w-auto mx-auto object-contain`} />;
			break;
		case "video":
			body = (
				<video src={url} controls preload="metadata" onClick={stop} className={`${maxHeight} w-auto mx-auto`} />
			);
			break;
		case "audio":
			body = <audio src={url} controls onClick={stop} className="w-full" />;
			break;
		case "html":
			body = (
				<iframe
					srcDoc={html}
					title="HTML preview"
					sandbox="allow-scripts"
					onClick={stop}
					className="w-full h-64 bg-white border-0"
				/>
			);
			break;
		default:
			body = (
				<div className="grid place-items-center h-40 border border-line">
					<span className="micro text-muted">{(category ?? "File").toUpperCase()} · No preview</span>
				</div>
			);
	}

	if (bare) return <div className={`grid place-items-center ${className}`}>{body}</div>;

	return (
		<div className={`flex flex-col gap-3 ${className}`}>
			<div className="bg-background grid place-items-center p-3">{body}</div>
			<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13px]">
				<dt className="micro text-faint pt-[3px]">Name</dt>
				<dd className="truncate">{file.name}</dd>
				<dt className="micro text-faint pt-[3px]">Size</dt>
				<dd className="tabular-nums">{formatBytes(file.size)}</dd>
				<dt className="micro text-faint pt-[3px]">Type</dt>
				<dd className="truncate">{file.type || category || "Unknown"}</dd>
			</dl>
		</div>
	);
}
