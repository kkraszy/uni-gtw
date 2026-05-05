#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""
Merge multiple packaged-binaries directories into one.

Combines all binary/json/text files from each input directory into the output
directory. esp_web_tools_manifest.json entries are merged into a single manifest.
app_binaries.txt files are merged (deduplicating lines). All input manifests must
share the same project version — fails loudly on mismatch.
"""

import argparse
import json
import shutil
import sys
from pathlib import Path


MANIFEST_NAME = "esp_web_tools_manifest.json"
APP_BINS_NAME = "app_binaries.txt"


def merge_directories(input_dirs: list[Path], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    combined_manifest: dict | None = None
    app_bins: list[str] = []

    for src_dir in input_dirs:
        if not src_dir.is_dir():
            print(f"WARNING: {src_dir} is not a directory, skipping", file=sys.stderr)
            continue

        # Merge manifest
        manifest_path = src_dir / MANIFEST_NAME
        if manifest_path.exists():
            with open(manifest_path) as f:
                manifest = json.load(f)

            if combined_manifest is None:
                combined_manifest = {
                    "name": manifest["name"],
                    "version": manifest["version"],
                    "new_install_prompt_erase": manifest.get("new_install_prompt_erase", False),
                    "builds": [],
                }
            elif manifest["version"] != combined_manifest["version"]:
                print(
                    f"ERROR: version mismatch — {src_dir} has v{manifest['version']}, "
                    f"expected v{combined_manifest['version']}",
                    file=sys.stderr,
                )
                sys.exit(1)

            combined_manifest["builds"].extend(manifest.get("builds", []))

        # Merge app_binaries.txt
        app_bins_path = src_dir / APP_BINS_NAME
        if app_bins_path.exists():
            for line in app_bins_path.read_text().splitlines():
                line = line.strip()
                if line and line not in app_bins:
                    app_bins.append(line)

        # Copy all other files
        for f in src_dir.iterdir():
            if f.name in (MANIFEST_NAME, APP_BINS_NAME):
                continue
            if f.is_file():
                dest = output_dir / f.name
                if dest.exists():
                    print(f"  WARNING: {f.name} already exists in output, overwriting", file=sys.stderr)
                shutil.copy2(f, dest)

    if combined_manifest is not None:
        with open(output_dir / MANIFEST_NAME, "w") as f:
            json.dump(combined_manifest, f, indent=4)

    if app_bins:
        (output_dir / APP_BINS_NAME).write_text("\n".join(app_bins) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Merge multiple packaged-binaries directories into one."
    )
    parser.add_argument("input_dirs", nargs="+", type=Path, help="Input directories to merge")
    parser.add_argument("-o", "--output", type=Path, required=True, help="Output directory")
    args = parser.parse_args()

    if args.output.exists():
        shutil.rmtree(args.output)

    merge_directories(args.input_dirs, args.output)
    print(f"Merged {len(args.input_dirs)} director(ies) into {args.output}")


if __name__ == "__main__":
    main()
