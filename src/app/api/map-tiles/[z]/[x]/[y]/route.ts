import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fallbackCacheSeconds = 7 * 24 * 60 * 60;
const maxZoom = 19;

function positiveInteger(value: string): number | null {
	if (!/^\d{1,10}$/.test(value)) return null;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : null;
}

function cacheLifetime(header: string | null): number {
	const match = header?.match(/(?:^|,)\s*max-age=(\d+)/i);
	if (!match) return fallbackCacheSeconds;
	const seconds = Number(match[1]);
	return Number.isSafeInteger(seconds) && seconds > 0
		? seconds
		: fallbackCacheSeconds;
}

/**
 * Fetches only a single user-requested OpenStreetMap raster tile. The Vercel
 * CDN caches the response, while the upstream request stays identifiable and
 * honours OSM's cache lifetime (or its seven-day minimum when absent).
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
	const { z: rawZoom, x: rawX, y: rawY } = await params;
	const zoom = positiveInteger(rawZoom);
	const x = positiveInteger(rawX);
	const y = positiveInteger(rawY);
	if (zoom === null || x === null || y === null || zoom > maxZoom) {
		return NextResponse.json(
			{ error: "Invalid map tile coordinates." },
			{ status: 400 },
		);
	}
	const tileCount = 2 ** zoom;
	if (x >= tileCount || y >= tileCount) {
		return NextResponse.json(
			{ error: "Map tile is outside the zoom range." },
			{ status: 400 },
		);
	}

	try {
		const configuredSite = process.env.NEXT_PUBLIC_SITE_URL;
		const siteUrl = configuredSite
			? new URL(configuredSite)
			: new URL(request.url);
		const upstream = await fetch(
			`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
			{
				headers: {
					accept: "image/png",
					"user-agent": `HackOS Map Tiles/1.0 (+${siteUrl.origin})`,
					referer: `${siteUrl.origin}/`,
					...(request.headers.get("if-none-match")
						? { "if-none-match": request.headers.get("if-none-match") ?? "" }
						: {}),
					...(request.headers.get("if-modified-since")
						? {
								"if-modified-since":
									request.headers.get("if-modified-since") ?? "",
							}
						: {}),
				},
				cache: "no-store",
				signal: AbortSignal.timeout(8_000),
			},
		);
		if (upstream.status === 304) {
			const maxAge = cacheLifetime(upstream.headers.get("cache-control"));
			return new Response(null, {
				status: 304,
				headers: {
					"Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=86400`,
					"Vercel-CDN-Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=86400`,
					...(upstream.headers.get("etag")
						? { ETag: upstream.headers.get("etag") ?? "" }
						: {}),
					...(upstream.headers.get("last-modified")
						? { "Last-Modified": upstream.headers.get("last-modified") ?? "" }
						: {}),
				},
			});
		}
		const contentType = upstream.headers.get("content-type");
		if (!upstream.ok || !contentType?.startsWith("image/")) {
			return NextResponse.json(
				{ error: "Map tiles are temporarily unavailable." },
				{ status: 502, headers: { "Cache-Control": "no-store" } },
			);
		}

		const maxAge = cacheLifetime(upstream.headers.get("cache-control"));
		const headers = new Headers({
			"Content-Type": contentType,
			"Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=86400`,
			"Vercel-CDN-Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=86400`,
			"X-Content-Type-Options": "nosniff",
		});
		const etag = upstream.headers.get("etag");
		if (etag) headers.set("ETag", etag);
		const lastModified = upstream.headers.get("last-modified");
		if (lastModified) headers.set("Last-Modified", lastModified);
		return new Response(await upstream.arrayBuffer(), { headers });
	} catch {
		return NextResponse.json(
			{ error: "Map tiles are temporarily unavailable." },
			{ status: 502, headers: { "Cache-Control": "no-store" } },
		);
	}
}
