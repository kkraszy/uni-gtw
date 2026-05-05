#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""
Package ESP32 build binaries into a flat, versioned directory for distribution.

For each build/<target>/ directory containing flasher_args.json and
project_description.json:
  - Copies all flash binaries (flattened) renamed to <name>-<target>-<version>.bin
  - Copies flasher_args.json renamed to flasher_args-<target>-<version>.json
    with internal file references updated to the new flat names
  - Copies flash_args renamed to flash_args-<target> with paths updated
  - Copies the app ELF renamed to <name>-<target>-<version>.elf
"""

import json
import shutil
import sys
from pathlib import Path


def find_build_dirs(build_root: Path) -> list[Path]:
    return sorted(
        p.parent
        for p in build_root.glob("*/flasher_args.json")
        if (p.parent / "project_description.json").exists()
    )


def flat_name(original: str) -> str:
    """Return just the filename component of a (possibly nested) path."""
    return Path(original).name


def process_target(build_dir: Path, out_dir: Path) -> None:
    with open(build_dir / "project_description.json") as f:
        desc = json.load(f)
    with open(build_dir / "flasher_args.json") as f:
        flasher = json.load(f)

    target: str = desc["target"]
    version: str = desc["project_version"]
    suffix = f"{target}-{version}"

    # --- collect all binary files referenced in flasher_args ---
    flash_files: dict[str, str] = flasher.get("flash_files", {})

    # Build mapping: original relative path -> new flat filename
    rename_map: dict[str, str] = {}
    for _offset, rel_path in flash_files.items():
        base = flat_name(rel_path)
        stem = Path(base).stem
        new_name = f"{stem}-{suffix}.bin"
        rename_map[rel_path] = new_name

    # Copy binaries
    for rel_path, new_name in rename_map.items():
        src = build_dir / rel_path
        if not src.exists():
            print(f"  WARNING: {src} not found, skipping", file=sys.stderr)
            continue
        shutil.copy2(src, out_dir / new_name)

    # --- update flasher_args and write it ---
    updated_flasher = json.loads(json.dumps(flasher))  # deep copy

    updated_flash_files: dict[str, str] = {}
    for offset, rel_path in flash_files.items():
        updated_flash_files[offset] = rename_map.get(rel_path, flat_name(rel_path))
    updated_flasher["flash_files"] = updated_flash_files

    # Also update the named binary entries (bootloader, partition-table, etc.)
    named_keys = [k for k in updated_flasher if k not in
                  ("write_flash_args", "flash_settings", "flash_files", "extra_esptool_args")]
    for key in named_keys:
        entry = updated_flasher[key]
        if isinstance(entry, dict) and "file" in entry:
            old = entry["file"]
            entry["file"] = rename_map.get(old, flat_name(old))

    out_flasher = out_dir / f"flasher_args-{suffix}.json"
    with open(out_flasher, "w") as f:
        json.dump(updated_flasher, f, indent=4)

    # --- copy and update flash_args text file ---
    flash_args_src = build_dir / "flash_args"
    if flash_args_src.exists():
        lines = flash_args_src.read_text().splitlines()
        updated_lines = []
        for line in lines:
            parts = line.split()
            new_parts = []
            for part in parts:
                if part in rename_map:
                    new_parts.append(rename_map[part])
                else:
                    new_parts.append(part)
            updated_lines.append(" ".join(new_parts))
        (out_dir / f"flash_args-{target}").write_text("\n".join(updated_lines) + "\n")

    # --- copy ELF ---
    app_elf = desc.get("app_elf", "")
    if app_elf:
        elf_src = build_dir / app_elf
        if elf_src.exists():
            elf_stem = Path(app_elf).stem
            shutil.copy2(elf_src, out_dir / f"{elf_stem}-{suffix}.elf")
        else:
            print(f"  WARNING: ELF {elf_src} not found", file=sys.stderr)

    print(f"  Packaged {target} v{version} -> {out_dir}")


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    build_root = repo_root / "build"
    out_dir = build_root / "packaged-binaries"

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    build_dirs = find_build_dirs(build_root)
    if not build_dirs:
        print("No build directories with flasher_args.json found.", file=sys.stderr)
        sys.exit(1)

    for bd in build_dirs:
        print(f"Processing {bd.name}...")
        process_target(bd, out_dir)

    print("Done.")


if __name__ == "__main__":
    main()
