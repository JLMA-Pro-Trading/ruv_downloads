#!/bin/bash
set -e
set -o pipefail

# Ensure we are running in the script's directory
cd "$(dirname "$0")"

# NPM user/profile URL to indicate the source of the packages
NPM_USER_URL="https://www.npmjs.com/~ruvnet"
MANIFEST_FILE="packagelist.dynamic.txt"

# Basic runtime checks to fail fast and provide helpful errors
required_cmds=(curl npm grep sed sort mktemp)
for _cmd in "${required_cmds[@]}"; do
  if ! command -v "$_cmd" >/dev/null 2>&1; then
    echo "Error: required command '$_cmd' not found in PATH. Please install it and retry." >&2
    exit 1
  fi
done

echo "Checking packages from: $NPM_USER_URL"

# Arg parsing: support --discover and --discover-only
DISCOVER=0
DISCOVER_ONLY=0
for a in "$@"; do
  case "$a" in
    --discover) DISCOVER=1 ;;
    --discover-only) DISCOVER=1; DISCOVER_ONLY=1 ;;
  esac
done

# Step 1: Load existing packages from manifest file (or initialize)
EXISTING_PACKAGES=()
if [ -f "$MANIFEST_FILE" ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    EXISTING_PACKAGES+=("$line")
  done < "$MANIFEST_FILE"
fi

# Step 2: If discovery is enabled, query npm registry for packages maintained by user `ruvnet`
DISCOVERED_PACKAGES=()
if [ "$DISCOVER" -eq 1 ]; then
  echo "Discovering packages from npm registry for user: ruvnet ..."
  pkg_json=$(curl -s -A "ruvnet-downloader (github-actions)" "https://registry.npmjs.org/-/v1/search?text=maintainer:ruvnet&size=250")
  # extract package names without requiring jq
  IFS=$'\n' DISCOVERED_PACKAGES=( $(echo "$pkg_json" | grep -o '"name":"[^"]\+' | sed -E 's/"name":"//' | sort -u || true) )
  unset IFS
  
  if [ ${#DISCOVERED_PACKAGES[@]} -gt 0 ]; then
    echo "  Discovered ${#DISCOVERED_PACKAGES[@]} packages from npm registry"
  else
    echo "  Warning: no packages discovered from npm registry"
  fi
fi

# Step 3: Merge existing + discovered packages into unified list (remove duplicates)
# Use a temporary file for deduplication instead of associative arrays (macOS bash compatibility)
TEMP_MERGED=$(mktemp)
trap "rm -f $TEMP_MERGED" EXIT

# Build merged list: existing + discovered + already-downloaded tarball files
{
  printf "%s\n" "${EXISTING_PACKAGES[@]}"
  printf "%s\n" "${DISCOVERED_PACKAGES[@]}"
  # Also auto-discover packages that are already present as *.tgz files in folder or 00_tgz/ subfolder
  for tgz_file in *.tgz 00_tgz/*.tgz; do
    if [ -e "$tgz_file" ]; then
      # Extract package name from tarball (format varies: scoped @org/pkg or plain pkg)
      basename "$tgz_file" | sed 's/-[0-9.]*\.tgz$//'
    fi
  done
} | grep -v '^$' | sort -u > "$TEMP_MERGED"

MERGED_PACKAGES=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  MERGED_PACKAGES+=("$line")
done < "$TEMP_MERGED"

# Step 4: Save merged list to manifest (this is the SINGLE SOURCE OF TRUTH)
echo "  Total packages (merged): ${#MERGED_PACKAGES[@]}"
printf "%s\n" "${MERGED_PACKAGES[@]}" | sort -u > "$MANIFEST_FILE"

# Step 5: If discovery-only mode, show and exit
if [ "$DISCOVER_ONLY" -eq 1 ]; then
  echo "Discovery-only mode; listing unified packages manifest:"
  printf "%s\n" "${MERGED_PACKAGES[@]}" | sort
  exit 0
fi

PACKAGES=("${MERGED_PACKAGES[@]}")

# Create 00_tgz directory if it doesn't exist
mkdir -p 00_tgz
# Create legacy directory
mkdir -p 00_tgz/legacy_tgz

for pkg in "${PACKAGES[@]}"
do
  echo "Checking: $pkg"
  # Get latest published version from the registry
  latest_version=$(npm view "$pkg" version 2>/dev/null || true)
  if [ -z "$latest_version" ]; then
    echo "  Warning: package not found on npm: $pkg -- skipping"
    continue
  fi

  # Build a few candidate filename patterns that npm pack may produce
  name_no_at=${pkg//@/}
  name_dash=${name_no_at//\//-}
  # Check if we have a newer version locally (e.g. manual download of alpha/beta)
  # This prevents downgrading if registry 'latest' is older than what we have
  newer_found=0
  name_underscore=${name_no_at//\//_}
  for local_file in 00_tgz/${name_dash}-*.tgz 00_tgz/${name_underscore}-*.tgz; do
    if [ -e "$local_file" ]; then
      # Extract version from filename
      # Remove path
      local_filename=$(basename "$local_file")
      # Remove extension
      local_ver_str="${local_filename%.tgz}"
      # Remove package name prefix (handle both dash and underscore variants)
      if [[ "$local_ver_str" == "${name_dash}-"* ]]; then
        local_ver="${local_ver_str#${name_dash}-}"
      elif [[ "$local_ver_str" == "${name_underscore}-"* ]]; then
        local_ver="${local_ver_str#${name_underscore}-}"
      else
        continue
      fi
      
      # Check if version is valid (starts with number)
      if [[ "$local_ver" =~ ^[0-9] ]]; then
        # Compare versions using sort -V
        if [ "$(printf "%s\n%s" "$latest_version" "$local_ver" | sort -V | tail -n1)" == "$local_ver" ] && [ "$local_ver" != "$latest_version" ]; then
          echo "  Up-to-date: $pkg@$local_ver (local is newer than registry $latest_version)"
          newer_found=1
          found=1
          break
        fi
      fi
    fi
  done

  if [ "$newer_found" -eq 1 ]; then
    continue
  fi

  # Candidate file patterns that might already be present (exact match)
  candidates=(
    "${name_dash}-${latest_version}.tgz"
    "${name_underscore}-${latest_version}.tgz"
    "00_tgz/${name_dash}-${latest_version}.tgz"
    "00_tgz/${name_underscore}-${latest_version}.tgz"
  )

  found=0
  for candidate in "${candidates[@]}"; do
    if [ -e "$candidate" ]; then
      echo "  Up-to-date: $pkg@$latest_version"
      found=1
      break
    fi
  done

  if [ "$found" -eq 1 ]; then
    continue
  fi

  echo "  Downloading: $pkg@$latest_version"
  npm pack "$pkg"
  
  # Find the downloaded tarball (npm pack creates it in current directory)
  downloaded_tgz=""
  for candidate in "${candidates[@]}"; do
    candidate_basename=$(basename "$candidate")
    if [ -e "$candidate_basename" ]; then
      downloaded_tgz="$candidate_basename"
      break
    fi
  done
  
  if [ -n "$downloaded_tgz" ] && [ -e "$downloaded_tgz" ]; then
    echo "  Extracting: $downloaded_tgz"
    if tar -xzf "$downloaded_tgz"; then
      # Rename the extracted 'package/' directory to a unique name
      # Remove .tgz extension to get the package directory name
      pkg_dir_name="${downloaded_tgz%.tgz}"
      if [ -d "package" ]; then
        mv "package" "$pkg_dir_name"
        echo "  Extracted: $pkg_dir_name/"
      else
        echo "  Warning: package/ directory not found after extraction"
      fi
    else
      echo "  Warning: failed to extract $downloaded_tgz"
    fi
    
    # Move the .tgz file to 00_tgz/ directory
    echo "  Moving: $downloaded_tgz -> 00_tgz/"
    mv "$downloaded_tgz" "00_tgz/"
    
    # CLEANUP: Now that we have the latest version, move any older versions to legacy
    # We know the exact filename pattern, so this is safe
    for old_file in 00_tgz/${name_dash}-*.tgz 00_tgz/${name_underscore}-*.tgz; do
      if [ -e "$old_file" ]; then
        old_filename=$(basename "$old_file")
        # Skip if it's the file we just moved
        if [ "$old_filename" != "$downloaded_tgz" ]; then
          # Check if it matches our package name pattern exactly
          # Extract version from filename and compare
          if [[ "$old_filename" =~ ^${name_dash}-[0-9]+\.[0-9]+\.[0-9]+.*\.tgz$ ]] || [[ "$old_filename" =~ ^${name_underscore}-[0-9]+\.[0-9]+\.[0-9]+.*\.tgz$ ]]; then
            echo "  Cleanup: Moving older version $old_filename to legacy_tgz/"
            mv "$old_file" "00_tgz/legacy_tgz/"
          fi
        fi
      fi
    done
    
    # Also cleanup old decompressed directories
    for old_dir in ${name_dash}-*/ ${name_underscore}-*/; do
      if [ -d "$old_dir" ]; then
        old_dirname=${old_dir%/}
        # Skip if it's the directory we just created
        if [ "$old_dirname" != "$pkg_dir_name" ]; then
          echo "  Cleanup: Removing older decompressed version $old_dirname"
          rm -rf "$old_dirname"
        fi
      fi
    done
  else
    echo "  Warning: could not find downloaded tarball for $pkg@$latest_version"
  fi
done

echo "All npm package downloads complete! Only missing/new packages were downloaded."