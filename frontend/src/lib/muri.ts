import type { Address } from "viem";
import fastlz from "./fastlz";
import { resolveMimeType } from "../utils/fileValidation";

export const MURI_ADDRESS = import.meta.env.VITE_MURI_ADDRESS as Address;
export const MURI_EXTENSION_ADDRESS = import.meta.env.VITE_MURI_EXTENSION_ADDRESS as Address;

export type CollectionType = "ERC721" | "ERC1155";

// Permission bit layout from MURIProtocol.sol.
export const PERMISSION = {
	artistUpdateThumb: 1 << 0,
	artistUpdateMeta: 1 << 1,
	artistChooseUris: 1 << 2,
	artistAddRemove: 1 << 3,
	artistChooseThumb: 1 << 4,
	artistUpdateMode: 1 << 5,
	artistUpdateTemplate: 1 << 6,
	collectorChooseUris: 1 << 7,
	collectorAddRemove: 1 << 8,
	collectorChooseThumb: 1 << 9,
	collectorUpdateMode: 1 << 10,
} as const;

export type PermissionKey = keyof typeof PERMISSION;

export const ARTIST_PERMISSIONS: { key: PermissionKey; label: string }[] = [
	{ key: "artistUpdateMeta", label: "Edit metadata" },
	{ key: "artistAddRemove", label: "Add and remove URIs" },
	{ key: "artistChooseUris", label: "Choose the displayed URI" },
	{ key: "artistUpdateMode", label: "Change display mode" },
	{ key: "artistUpdateThumb", label: "Replace thumbnail" },
	{ key: "artistChooseThumb", label: "Choose the thumbnail URI" },
	{ key: "artistUpdateTemplate", label: "Replace HTML template" },
];

export const COLLECTOR_PERMISSIONS: { key: PermissionKey; label: string }[] = [
	{ key: "collectorAddRemove", label: "Add and remove their own URIs" },
	{ key: "collectorChooseUris", label: "Choose the displayed URI" },
	{ key: "collectorUpdateMode", label: "Change display mode" },
	{ key: "collectorChooseThumb", label: "Choose the thumbnail URI" },
];

const ALL_ARTIST = ARTIST_PERMISSIONS.reduce((f, p) => f | PERMISSION[p.key], 0);
const ALL_COLLECTOR = COLLECTOR_PERMISSIONS.reduce((f, p) => f | PERMISSION[p.key], 0);

export const PERMISSION_PRESETS = {
	collaborative: ALL_ARTIST | ALL_COLLECTOR,
	artist: ALL_ARTIST,
	frozen: 0,
} as const;

export type PermissionPreset = keyof typeof PERMISSION_PRESETS;

export const hasPermission = (flags: number, key: PermissionKey) =>
	(flags & PERMISSION[key]) !== 0;

export const DISPLAY_MODES = [
	{
		value: 1,
		name: "Smart HTML",
		description:
			"An on-chain page tries every URI in order and verifies the file hash. Survives dead links automatically.",
	},
	{
		value: 0,
		name: "Direct file",
		description:
			"Marketplaces load the selected URI as-is. Simpler, but someone has to switch it when a link dies.",
	},
] as const;

export const THUMBNAIL_MAX_BYTES = 60 * 1024;
const CHUNK_BYTES = 20 * 1024;

export async function hashFile(file: File): Promise<`0x${string}`> {
	const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
	return `0x${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export interface PreparedThumbnail {
	file: File;
	mimeType: string;
	bytes: number;
	/** Compressed size: what is actually written on-chain. */
	storedBytes: number;
	chunks: `0x${string}`[];
}

/** FastLZ-compress an image and split it into SSTORE2-sized hex chunks. */
export async function prepareOnChainThumbnail(file: File): Promise<PreparedThumbnail> {
	if (file.size > THUMBNAIL_MAX_BYTES) {
		throw new Error(
			`On-chain thumbnails are limited to ${THUMBNAIL_MAX_BYTES / 1024} KB. This one is ${(file.size / 1024).toFixed(1)} KB.`
		);
	}
	const buffer = new Uint8Array(await file.arrayBuffer());
	const compressed = fastlz.compress(buffer);
	const chunks: `0x${string}`[] = [];
	for (let i = 0; i < compressed.length; i += CHUNK_BYTES) {
		const chunk = compressed.slice(i, i + CHUNK_BYTES);
		chunks.push(
			`0x${Array.from(chunk)
				.map((b) => (b as number).toString(16).padStart(2, "0"))
				.join("")}`
		);
	}
	return { file, mimeType: resolveMimeType(file), bytes: buffer.byteLength, storedBytes: compressed.length, chunks };
}

export interface PreparedTemplate {
	file: File;
	characters: number;
	bytes: number;
	chunks: string[];
}

/**
 * Split text into chunks of at most `maxBytes` UTF-8 bytes, cutting only between characters: the
 * contract stores each chunk as bytes, and a cut through a multi-byte character would corrupt it.
 */
export function splitUtf8(text: string, maxBytes: number): string[] {
	const encoder = new TextEncoder();
	const chunks: string[] = [];
	let current = "";
	let size = 0;
	for (const char of text) {
		const n = encoder.encode(char).length;
		if (size + n > maxBytes) {
			chunks.push(current);
			current = "";
			size = 0;
		}
		current += char;
		size += n;
	}
	if (current) chunks.push(current);
	return chunks;
}

/** HTML templates are stored as plain text chunks. */
export async function prepareHtmlTemplate(file: File): Promise<PreparedTemplate> {
	const isHtml =
		file.type === "text/html" || /\.html?$/i.test(file.name);
	if (!isHtml) throw new Error("Choose an .html file.");
	const content = await file.text();
	// The contract substitutes these exact strings; a spaced "{{ FILE_URIS }}" is left untouched.
	for (const placeholder of ["{{FILE_URIS}}", "{{FILE_HASH}}"]) {
		if (!content.includes(placeholder)) {
			throw new Error(
				`The template needs a ${placeholder} placeholder (exactly like that, no spaces) so the contract can fill it in.`
			);
		}
	}
	return {
		file,
		characters: content.length,
		bytes: new TextEncoder().encode(content).length,
		chunks: splitUtf8(content, CHUNK_BYTES),
	};
}

export interface Attribute {
	trait_type: string;
	value: string;
	/** Keys the editor doesn't show (display_type, max_value…), kept as they were. */
	extra?: Record<string, unknown>;
	/** The value was a number on-chain; it stays one while it still reads as a number. */
	numeric?: boolean;
}

export interface Metadata {
	name: string;
	description: string;
	attributes: Attribute[];
	/** Every other top-level key, kept as it was. */
	rest: Record<string, unknown>;
}

/** The inside of a JSON object, as the contract stores metadata (no surrounding braces). */
const fieldsOf = (object: Record<string, unknown>) => JSON.stringify(object).slice(1, -1);

/**
 * Build the metadata the contract stores. Only name, description and attributes are edited here;
 * `rest` and each attribute's `extra` carry everything else through unchanged.
 */
export function buildMetadataFields(
	name: string,
	description: string,
	attributes: Attribute[],
	rest: Record<string, unknown> = {}
) {
	const object: Record<string, unknown> = {};
	if (name.trim()) object.name = name.trim();
	if (description.trim()) object.description = description.trim();
	const valid = attributes.filter((a) => a.trait_type.trim() && a.value.trim());
	if (valid.length > 0) {
		object.attributes = valid.map((a) => {
			const value = a.value.trim();
			const asNumber = Number(value);
			return {
				...a.extra,
				trait_type: a.trait_type.trim(),
				value: a.numeric && value !== "" && Number.isFinite(asNumber) ? asNumber : value,
			};
		});
	}
	for (const [key, value] of Object.entries(rest)) {
		if (!(key in object)) object[key] = value;
	}
	return fieldsOf(object);
}

export function parseMetadata(raw: string): Metadata {
	try {
		const parsed = JSON.parse(`{${raw}}`) as Record<string, unknown>;
		const { name, description, attributes, ...rest } = parsed;
		const list = Array.isArray(attributes) ? (attributes as Record<string, unknown>[]) : [];
		return {
			name: typeof name === "string" ? name : "",
			description: typeof description === "string" ? description : "",
			attributes: list.map((a) => {
				const { trait_type, value, ...extra } = a ?? {};
				return {
					trait_type: String(trait_type ?? ""),
					value: String(value ?? ""),
					extra: Object.keys(extra).length ? extra : undefined,
					numeric: typeof value === "number",
				};
			}),
			rest,
		};
	} catch {
		return { name: "", description: "", attributes: [], rest: {} };
	}
}

export function parseMetadataFields(raw: string): { name: string; description: string; attributes: Attribute[] } {
	const { name, description, attributes } = parseMetadata(raw);
	return { name, description, attributes };
}

export const shortAddress = (address: string) =>
	address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;

export const formatBytes = (bytes: number) => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};
