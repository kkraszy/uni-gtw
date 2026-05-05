import type { LoadContext, Plugin } from "@docusaurus/types";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import AdmZip from "adm-zip";

const PLUGIN_NAME = "firmware-releases-plugin";
const GITHUB_OWNER = "alufers";
const GITHUB_REPO = "uni-gtw";
const MAX_RELEASES = 5;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface ReleaseInfo {
  tag: string;
  name: string;
  publishedAt: string;
  prerelease: boolean;
  manifestPath: string;
  releaseUrl: string;
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  assets: GitHubAsset[];
}

interface ReleaseCacheEntry extends ReleaseInfo {
  zipAssetUrl: string;
}

interface CacheData {
  fetchedAt: number;
  releases: ReleaseCacheEntry[];
}

async function fetchGitHubReleases(
  token: string | undefined
): Promise<GitHubRelease[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "docusaurus-firmware-plugin",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=${MAX_RELEASES}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    throw new Error(`GitHub API returned ${resp.status}: ${await resp.text()}`);
  }
  return resp.json() as Promise<GitHubRelease[]>;
}

async function downloadAndExtract(
  zipUrl: string,
  destDir: string,
  token: string | undefined
): Promise<void> {
  const headers: Record<string, string> = {
    "User-Agent": "docusaurus-firmware-plugin",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const resp = await fetch(zipUrl, { headers });
  if (!resp.ok) {
    throw new Error(`Download failed with status ${resp.status}`);
  }
  const buffer = Buffer.from(await resp.arrayBuffer());
  await fs.mkdir(destDir, { recursive: true });
  const zip = new AdmZip(buffer);
  zip.extractAllTo(destDir, true);
}

export default function firmwareReleasesPlugin(
  context: LoadContext
): Plugin<ReleaseInfo[]> {
  const firmwareStaticDir = path.join(context.siteDir, "static", "firmware");
  const cacheFile = path.join(
    context.siteDir,
    ".firmware-releases-cache.json"
  );

  return {
    name: PLUGIN_NAME,

    async loadContent(): Promise<ReleaseInfo[]> {
      const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
      const isCI = !!token;

      // Layer 1: release list cache (TTL-based; always bypass on CI)
      let cachedReleases: ReleaseCacheEntry[] | null = null;
      try {
        const raw = await fs.readFile(cacheFile, "utf-8");
        const cache = JSON.parse(raw) as CacheData;
        if (!isCI && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
          cachedReleases = cache.releases;
        }
      } catch {
        // Cache missing or corrupt — will re-fetch
      }

      let releases: ReleaseCacheEntry[];
      if (cachedReleases) {
        releases = cachedReleases;
      } else {
        console.log("[firmware-releases] Fetching release list from GitHub…");
        let ghReleases: GitHubRelease[] = [];
        try {
          ghReleases = await fetchGitHubReleases(token);
        } catch (err) {
          console.warn(`[firmware-releases] GitHub fetch failed: ${err}`);
        }

        releases = ghReleases
          .filter((r) => !r.draft)
          .slice(0, MAX_RELEASES)
          .map((r) => {
            const zipAsset = r.assets.find((a) =>
              /^uni-gtw-.*\.zip$/.test(a.name)
            );
            return {
              tag: r.tag_name,
              name: r.name || r.tag_name,
              publishedAt: r.published_at,
              prerelease: r.prerelease,
              manifestPath: `firmware/${r.tag_name}/esp_web_tools_manifest.json`,
              releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${r.tag_name}`,
              zipAssetUrl: zipAsset?.browser_download_url ?? "",
            };
          });

        try {
          await fs.writeFile(
            cacheFile,
            JSON.stringify({ fetchedAt: Date.now(), releases } satisfies CacheData, null, 2)
          );
        } catch (err) {
          console.warn(`[firmware-releases] Could not write cache: ${err}`);
        }
      }

      // Layer 2: zip-extract cache (existence-based; tags are immutable)
      await fs.mkdir(firmwareStaticDir, { recursive: true });

      const validReleases: ReleaseInfo[] = [];
      for (const release of releases) {
        const releaseDir = path.join(firmwareStaticDir, release.tag);
        const manifestFile = path.join(
          releaseDir,
          "esp_web_tools_manifest.json"
        );

        let alreadyExtracted = false;
        try {
          await fs.access(manifestFile);
          alreadyExtracted = true;
        } catch {
          // Not yet downloaded
        }

        if (!alreadyExtracted) {
          if (!release.zipAssetUrl) {
            console.warn(
              `[firmware-releases] No zip asset for ${release.tag}, skipping`
            );
            continue;
          }
          try {
            console.log(`[firmware-releases] Downloading ${release.tag}…`);
            await downloadAndExtract(release.zipAssetUrl, releaseDir, token);
            console.log(`[firmware-releases] Extracted ${release.tag}`);
          } catch (err) {
            console.warn(
              `[firmware-releases] Failed for ${release.tag}: ${err}`
            );
            continue;
          }
        }

        const { zipAssetUrl: _unused, ...releaseInfo } = release;
        validReleases.push(releaseInfo);
      }

      return validReleases;
    },

    async contentLoaded({ content, actions }) {
      actions.setGlobalData({ releases: content });
    },
  };
}
