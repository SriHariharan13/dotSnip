import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const dataFile = path.join(path.dirname(fileURLToPath(import.meta.url)), ".snip-links.json");

async function readLinks() {
	try {
		const links = JSON.parse(await readFile(dataFile, "utf8"));
		return Array.isArray(links) ? links : [];
	} catch (error) {
		if (error.code === "ENOENT") return [];
		throw error;
	}
}

async function saveLinks(links) {
	await mkdir(path.dirname(dataFile), { recursive: true });
	await writeFile(dataFile, JSON.stringify(links, null, 2));
}

function json(res, status, body) {
	res.statusCode = status;
	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify(body));
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk) => { body += chunk; });
		req.on("end", () => {
			try { resolve(JSON.parse(body)); } catch { reject(new Error("Invalid JSON")); }
		});
		req.on("error", reject);
	});
}

function linksApi() {
	return {
		name: "snip-links-api",
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const pathname = new URL(req.url, "http://localhost").pathname;
				try {
					if (pathname === "/api/links" && req.method === "GET") {
						json(res, 200, await readLinks());
						return;
					}

					if (pathname === "/api/links" && req.method === "POST") {
						const input = await readBody(req);
						let target;
						try { target = new URL(input.url); } catch {}
						if (!target || !["http:", "https:"].includes(target.protocol) || !target.hostname.includes(".")) {
							json(res, 400, { error: "Enter a valid web address." });
							return;
						}

						const links = await readLinks();
						const requestedCode = input.alias || input.code || "";
						if (requestedCode && !/^[A-Za-z0-9-]{3,24}$/.test(requestedCode)) {
							json(res, 400, { error: "Use 3 to 24 letters, numbers, or hyphens for the alias." });
							return;
						}
						if (requestedCode && links.some((link) => link.code.toLowerCase() === requestedCode.toLowerCase())) {
							json(res, 409, { error: "That alias is taken. Try another." });
							return;
						}

						let code = requestedCode;
						while (!code || links.some((link) => link.code === code)) {
							code = randomBytes(4).toString("base64url").slice(0, 6);
						}
						const link = { code, url: target.href, clicks: Number.isInteger(input.clicks) ? input.clicks : 0 };
						await saveLinks([link, ...links]);
						json(res, 201, link);
						return;
					}

					const deleteMatch = pathname.match(/^\/api\/links\/([^/]+)$/);
					if (deleteMatch && req.method === "DELETE") {
						const code = decodeURIComponent(deleteMatch[1]);
						const links = await readLinks();
						await saveLinks(links.filter((link) => link.code !== code));
						res.statusCode = 204;
						res.end();
						return;
					}

					const shortMatch = pathname.match(/^\/([^/]+)\/?$/);
					if (shortMatch && req.method === "GET") {
						const code = decodeURIComponent(shortMatch[1]);
						const links = await readLinks();
						const link = links.find((item) => item.code === code);
						if (link) {
							await saveLinks(links.map((item) => item.code === code ? { ...item, clicks: item.clicks + 1 } : item));
							res.statusCode = 302;
							res.setHeader("Location", link.url);
							res.end();
							return;
						}
					}

					next();
				} catch (error) {
					json(res, 500, { error: error.message || "Unable to process link." });
				}
			});
		},
	};
}

export default defineConfig({ plugins: [react(), linksApi()] });
