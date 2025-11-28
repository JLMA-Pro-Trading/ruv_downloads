#!/bin/bash
set -e
set -o pipefail

# Ensure we are running in the script's directory
cd "$(dirname "$0")"

# Crates.io user/profile URL (source of crates)
CRATES_IO_USER_URL="https://crates.io/users/ruvnet"
MANIFEST_FILE="crates.dynamic.txt"

# Basic runtime checks to fail fast and provide helpful errors
required_cmds=(curl grep sed sort mktemp)
for _cmd in "${required_cmds[@]}"; do
  if ! command -v "$_cmd" >/dev/null 2>&1; then
    echo "Error: required command '$_cmd' not found in PATH. Please install it and retry." >&2
    exit 1
  fi
done

echo "Checking crates from: $CRATES_IO_USER_URL"

# Arg parsing: support --discover and --discover-only
DISCOVER=0
DISCOVER_ONLY=0
for a in "$@"; do
  case "$a" in
    --discover) DISCOVER=1 ;;
    --discover-only) DISCOVER=1; DISCOVER_ONLY=1 ;;
  esac
done

# Step 1: Load existing crates from manifest file (or initialize)
EXISTING_CRATES=()
if [ -f "$MANIFEST_FILE" ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    EXISTING_CRATES+=("$line")
  done < "$MANIFEST_FILE"
fi

# Step 2: If discovery is enabled, discover new crates from crates.io
DISCOVERED_CRATES=()
if [ "$DISCOVER" -eq 1 ]; then
  echo "Discovering crates from crates.io for user: ruvnet ..."
    user_json=$(curl -s -A "ruvnet-downloader (github-actions)" "https://crates.io/api/v1/users/ruvnet")
    # Use the crates.io search API with user_id to find ALL crates
    # User ID for ruvnet is 339999
    # Implement pagination to get all results
    page=1
    while true; do
      echo "    Fetching page $page..."
      search_json=$(curl -s -A "ruvnet-downloader (github-actions)" "https://crates.io/api/v1/crates?page=${page}&per_page=100&user_id=339999")
      
      # Extract names from current page
      page_names=$(echo "$search_json" | grep -o '"name":"[^\"]\+' | sed -E 's/"name":"//' | sort -u || true)
      
      if [ -z "$page_names" ]; then
        break
      fi
      
      if [ -n "$page_names" ]; then
        IFS=$'\n'
        for name in $page_names; do
          DISCOVERED_CRATES+=("$name")
        done
        unset IFS
      fi
      
      # Check if we have more pages (simple check: if we got less than requested, we're done)
      # Or check total count vs current count. For simplicity, just check if result is empty or small.
      # Better: check "next_page" in response or just increment until empty.
      # The grep above returns empty if no names found.
      
      ((page++))
      # Safety break to prevent infinite loops
      if [ "$page" -gt 10 ]; then break; fi
    done

  # If empty, fallback to search API and HTML parsing
  if [ ${#DISCOVERED_CRATES[@]} -eq 0 ]; then
    echo "  API did not return crates; falling back to search API and HTML parsing"
    search_json=$(curl -s -A "ruvnet-downloader (github-actions)" "https://crates.io/api/v1/crates?page=1&per_page=100&user_id=339999")
    IFS=$'\n' DISCOVERED_CRATES=( $(echo "$search_json" | grep -o '"name":"[^"]\+' | sed -E 's/"name":"//' | sort -u || true) )
    unset IFS
    if [ ${#DISCOVERED_CRATES[@]} -eq 0 ]; then
      DISCOVERED_CRATES=( $(curl -s -A "ruvnet-downloader (github-actions)" "https://crates.io/users/ruvnet" | grep -o 'href="/crates/[^" ]\+' | sed -E 's/href="\/crates\/(.+)/\1/' | sed 's/"//' | sort -u || true) )
    fi
  fi

  if [ ${#DISCOVERED_CRATES[@]} -gt 0 ]; then
    echo "  Discovered ${#DISCOVERED_CRATES[@]} crates from crates.io"
  else
    echo "  Warning: no crates discovered from crates.io API"
  fi
fi

# Step 3: Merge existing + discovered crates into unified list (remove duplicates)
# Use a temporary file for deduplication instead of associative arrays (macOS bash compatibility)
TEMP_MERGED=$(mktemp)
trap "rm -f $TEMP_MERGED" EXIT

# Build merged list: existing + discovered + already-downloaded crate files
{
  printf "%s\n" "${EXISTING_CRATES[@]}"
  printf "%s\n" "${DISCOVERED_CRATES[@]}"
  # Also auto-discover crates that are already present as *.crate files in folder or 00_crates/ subfolder
  for crate_file in *.crate 00_crates/*.crate; do
    if [ -e "$crate_file" ]; then
      basename "$crate_file" | sed 's/-[0-9.]*\.crate$//'
    fi
  done
} | grep -v '^$' | grep -v '^[0-9]\+$' | sort -u > "$TEMP_MERGED"

MERGED_CRATES=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  MERGED_CRATES+=("$line")
done < "$TEMP_MERGED"

# Step 5: Save merged list to manifest (this is the SINGLE SOURCE OF TRUTH)
echo "  Total crates (merged): ${#MERGED_CRATES[@]}"
printf "%s\n" "${MERGED_CRATES[@]}" | sort -u > "$MANIFEST_FILE"

# Step 6: If discovery-only mode, show and exit
if [ "$DISCOVER_ONLY" -eq 1 ]; then
  echo "Discovery-only mode; listing unified crates manifest:"
  printf "%s\n" "${MERGED_CRATES[@]}" | sort
  exit 0
fi

CRATES=("${MERGED_CRATES[@]}")

# Create 00_crates directory if it doesn't exist
mkdir -p 00_crates
# Create legacy directory
mkdir -p 00_crates/legacy_crates

for crate in "${CRATES[@]}"
do
  echo "Checking: $crate"

  # Query crates.io API for latest published version
  latest_version=$(curl -s -A "ruvnet-downloader (github-actions)" "https://crates.io/api/v1/crates/${crate}" | grep -o '"max_version":"[^"]\+' | head -n1 | sed -E 's/"max_version":"(.*)/\1/' || true)

  if [ -z "$latest_version" ]; then
    echo "  Warning: crate not found on crates.io: $crate -- skipping"
    continue
  fi

  # Check if we have a newer version locally (e.g. yanked version that is newer than max_version)
  # This prevents downgrading if registry 'max_version' is older than what we have
  newer_found=0
  for local_file in 00_crates/${crate}-[0-9]*.crate; do
    if [ -e "$local_file" ]; then
      # Extract version from filename
      local_filename=$(basename "$local_file")
      # Remove extension
      local_ver_str="${local_filename%.crate}"
      # Remove crate name prefix
      local_ver="${local_ver_str#${crate}-}"
      
      # Check if version is valid (starts with number)
      if [[ "$local_ver" =~ ^[0-9] ]]; then
        # Compare versions using sort -V
        if [ "$(printf "%s\n%s" "$latest_version" "$local_ver" | sort -V | tail -n1)" == "$local_ver" ] && [ "$local_ver" != "$latest_version" ]; then
          echo "  Up-to-date: $crate@$local_ver (local is newer than registry $latest_version)"
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

  # Candidate file patterns that might already be present
  candidates=(
    "${crate}-${latest_version}.crate"
    "00_crates/${crate}-${latest_version}.crate"
  )

  found=0
  for candidate in "${candidates[@]}"; do
    if [ -e "$candidate" ]; then
      echo "  Up-to-date: $crate@$latest_version"
      found=1
      break
    fi
  done

  # CLEANUP: Remove older decompressed versions and move older .crate files
  # Check for any directory starting with crate name but NOT matching latest version
  # IMPORTANT: Use exact match pattern to avoid matching crates with similar names
  # Pattern: ${crate}-[0-9]* ensures we match ${crate}-1.0.0 but NOT ${crate}-something-1.0.0
  for dir in ${crate}-[0-9]*/; do
    if [ -d "$dir" ]; then
      dirname=${dir%/}
      if [ "$dirname" != "${crate}-${latest_version}" ]; then
        echo "  Cleanup: Removing older version $dirname"
        rm -rf "$dirname"
      fi
    fi
  done

  # Check for older .crate files in 00_crates
  # Use exact match pattern to avoid matching crates with similar names
  for file in 00_crates/${crate}-[0-9]*.crate; do
    if [ -e "$file" ]; then
      filename=$(basename "$file")
      if [ "$filename" != "${crate}-${latest_version}.crate" ]; then
        echo "  Cleanup: Moving older archive $filename to legacy_crates/"
        mv "$file" "00_crates/legacy_crates/"
      fi
    fi
  done

  if [ "$found" -eq 1 ]; then
    continue
  fi

  echo "  Downloading: $crate@$latest_version"
  # Download the specific crate version via crates.io API using -L to follow redirects.
  # This works even for yanked crates.
  download_url="https://crates.io/api/v1/crates/${crate}/${latest_version}/download"
  out_file="${crate}-${latest_version}.crate"
  if ! curl -L -A "ruvnet-downloader (github-actions)" -o "$out_file" "$download_url"; then
    echo "  Warning: failed to download $crate@$latest_version (HTTP error) -- skipping"
    continue
  fi
  echo "  Saved: $out_file"
  
  # Extract the crate to have both the .crate file and the extracted folder
  echo "  Extracting: $out_file"
  if tar -xzf "$out_file"; then
    echo "  Extracted: ${crate}-${latest_version}/"
  else
    echo "  Warning: failed to extract $out_file"
  fi
  
  # Move the .crate file to 00_crates/ directory
  echo "  Moving: $out_file -> 00_crates/"
  mv "$out_file" "00_crates/"
done

echo "All crate checks complete. Only missing/new versions were downloaded."
