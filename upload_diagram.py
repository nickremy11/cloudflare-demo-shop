#!/usr/bin/env python3
"""
Upload a diagram to R2 and tag it in KV.

Usage:
    python upload_diagram.py

The script will:
1. Open a macOS Finder dialog to select a .png or .jpg file
2. Prompt you to select tags from a list
3. Upload the file to R2 (demo-shop-diagrams/)
4. Store the tags in KV (namespace: 718464f9865547c68d5e62aaefe9db85)
"""

import os
import subprocess
import sys


def select_file():
    """Open macOS Finder dialog to select a file."""
    script = '''
    tell application "Finder"
        activate
        set selectedFile to choose file with prompt "Select a diagram file (.png or .jpg):" of type {"png", "jpg", "jpeg"}
        return POSIX path of selectedFile
    end tell
    '''

    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        print("No file selected or dialog cancelled.")
        sys.exit(1)


def select_tags():
    """Present tag options and let user select multiple."""
    tags = [
        "AppSec",
        "Performance",
        "Developers",
        "Zero Trust",
        "Network Security",
    ]

    print("\nAvailable tags:")
    for i, tag in enumerate(tags, 1):
        print(f"  {i}. {tag}")

    while True:
        selection = input(
            "\nEnter tag numbers separated by commas (e.g., 1,3,5): "
        ).strip()
        if not selection:
            print("Please select at least one tag.")
            continue

        try:
            indices = [int(x.strip()) for x in selection.split(",")]
            selected = []
            for idx in indices:
                if idx < 1 or idx > len(tags):
                    print(f"Invalid option: {idx}")
                    break
                selected.append(tags[idx - 1])
            else:
                return selected
        except ValueError:
            print("Invalid input. Please enter numbers separated by commas.")


def upload_to_r2(file_path):
    """Upload file to R2."""
    filename = os.path.basename(file_path)
    bucket_path = f"demo-shop-diagrams/{filename}"

    print(f"\nUploading {filename} to R2...")

    cmd = [
        "npx",
        "wrangler",
        "r2",
        "object",
        "put",
        bucket_path,
        "--file",
        file_path,
        "--remote",
    ]

    try:
        subprocess.run(cmd, check=True)
        print(f"  ✓ Uploaded to R2: {bucket_path}")
        return filename
    except subprocess.CalledProcessError as e:
        print(f"  ✗ R2 upload failed: {e}")
        sys.exit(1)


def add_tags_to_kv(filename, tags):
    """Add tags to KV."""
    tags_str = ",".join(tags)
    key = f"diagram_tags:{filename}"

    print(f"\nAdding tags to KV...")

    cmd = [
        "npx",
        "wrangler",
        "kv",
        "key",
        "put",
        "--namespace-id=718464f9865547c68d5e62aaefe9db85",
        key,
        tags_str,
        "--remote",
    ]

    try:
        subprocess.run(cmd, check=True)
        print(f"  ✓ Tags added to KV: {key} = {tags_str}")
    except subprocess.CalledProcessError as e:
        print(f"  ✗ KV tag upload failed: {e}")
        sys.exit(1)


def main():
    print("=== Cloudflare Demo Shop Diagram Uploader ===")

    # Select file
    file_path = select_file()
    print(f"Selected: {file_path}")

    # Validate extension
    ext = os.path.splitext(file_path)[1].lower()
    if ext not in [".png", ".jpg", ".jpeg"]:
        print(f"Error: Only .png and .jpg files are allowed. Got: {ext}")
        sys.exit(1)

    # Select tags
    tags = select_tags()
    print(f"Selected tags: {', '.join(tags)}")

    # Upload
    filename = upload_to_r2(file_path)
    add_tags_to_kv(filename, tags)

    print("\n=== Upload complete! ===")


if __name__ == "__main__":
    main()
