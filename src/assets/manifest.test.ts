import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface AssetSource {
  readonly licenseFile: string;
  readonly files: readonly string[];
}

interface AssetManifest {
  readonly sources: readonly AssetSource[];
}

function publicPath(webPath: string): string {
  expect(webPath.startsWith("/")).toBe(true);
  expect(webPath.includes("..")).toBe(false);
  return resolve(process.cwd(), "public", webPath.slice(1));
}

describe("asset manifest", () => {
  it("references existing licensed files only", () => {
    const manifestPath = resolve(process.cwd(), "public/assets/assets.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AssetManifest;
    expect(manifest.sources.length).toBeGreaterThan(0);
    for (const source of manifest.sources) {
      expect(existsSync(publicPath(source.licenseFile))).toBe(true);
      expect(source.files.length).toBeGreaterThan(0);
      for (const file of source.files) expect(existsSync(publicPath(file))).toBe(true);
    }
  });
});

