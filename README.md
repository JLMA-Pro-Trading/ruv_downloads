# Ruvnet Ecosystem Downloader

This repository contains tools to automatically discover, download, and manage packages from the Ruvnet ecosystem. It supports both **NPM packages** and **Rust crates**.

## Project Structure

- **`crates/`**: Contains Rust crates, the download script, and the manifest file.
- **`npmjs/`**: Contains NPM packages, the download script, and the manifest file.

## Features

- **Automatic Discovery**: Finds new packages maintained by `ruvnet` on NPM and Crates.io.
- **Version Management**: Ensures only the latest version of each package is kept in the main directory.
- **Legacy Archiving**: Automatically moves older versions to a `legacy` subfolder (`00_crates/legacy_crates` or `00_tgz/legacy_tgz`).
- **Decompression**: Automatically extracts downloaded archives for easy code inspection.
- **Manifest-driven**: Uses dynamic manifest files (`crates.dynamic.txt` and `packagelist.dynamic.txt`) to track managed packages.

## Usage

### NPM Packages

To download and update NPM packages:
```bash
./npmjs/download_ruvnet_packages.sh
```

To discover new packages from the registry and update the manifest:
```bash
./npmjs/download_ruvnet_packages.sh --discover
```

### Rust Crates

To download and update Rust crates:
```bash
./crates/download_ruvnet_crates.sh
```

To discover new crates from crates.io and update the manifest:
```bash
./crates/download_ruvnet_crates.sh --discover
```

## Output

- **Archives**: Downloaded `.tgz` (NPM) and `.crate` (Rust) files are stored in `00_tgz/` and `00_crates/` respectively.
- **Extracted Code**: Packages are extracted into their own directories within `npmjs/` and `crates/` for easy access.
