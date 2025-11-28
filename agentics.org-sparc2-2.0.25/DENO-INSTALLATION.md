# Deno Installation for SPARC2

SPARC2 requires [Deno](https://deno.land/) to run. This document provides instructions for installing Deno on different operating systems.

## What is Deno?

Deno is a secure runtime for JavaScript and TypeScript that SPARC2 uses for its core functionality. It provides a secure sandbox environment for executing code and has built-in TypeScript support.

## Automatic Installation

SPARC2 includes an automatic installation script for Deno. You can run it with:

```bash
# Make sure the script is executable
chmod +x ./install-deno.sh

# Run the installation script
./install-deno.sh
```

## Manual Installation

### Linux / macOS

You can install Deno on Linux or macOS using the following command:

```bash
curl -fsSL https://deno.land/install.sh | sh
```

After installation, you need to add Deno to your PATH. The installer will provide instructions, but typically you need to add these lines to your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"
```

Then reload your shell profile:

```bash
source ~/.bashrc  # or ~/.zshrc if you use Zsh
```

### Windows

#### Using PowerShell

Open PowerShell and run:

```powershell
irm https://deno.land/install.ps1 | iex
```

#### Using Chocolatey

If you have [Chocolatey](https://chocolatey.org/) installed:

```powershell
choco install deno
```

#### Using Scoop

If you have [Scoop](https://scoop.sh/) installed:

```powershell
scoop install deno
```

## Verifying Installation

After installation, verify that Deno is correctly installed by running:

```bash
deno --version
```

You should see output similar to:

```
deno 1.40.2 (release, aarch64-apple-darwin)
v8 12.1.285.27
typescript 5.3.3
```

## Troubleshooting

### Deno Not Found After Installation

If you've installed Deno but still get "command not found" errors:

1. Make sure Deno is in your PATH
2. Try restarting your terminal
3. Check if the installation directory exists (usually `~/.deno/bin`)

### Permission Issues

If you encounter permission issues during installation:

```bash
# Try with sudo (Linux/macOS)
sudo curl -fsSL https://deno.land/install.sh | sh

# Or specify a different installation directory
curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh
```

### Windows Path Issues

On Windows, you might need to manually add Deno to your PATH:

1. Search for "Environment Variables" in the Start menu
2. Click "Edit the system environment variables"
3. Click "Environment Variables" button
4. Under "User variables", find "Path" and click "Edit"
5. Click "New" and add the path to Deno (typically `%USERPROFILE%\.deno\bin`)
6. Click "OK" on all dialogs

## Using SPARC2 with Deno

Once Deno is installed, you can use SPARC2 commands normally:

```bash
# Using the CLI
sparc2 --help

# Using the MCP server
sparc2-mcp
```

## Additional Resources

- [Deno Official Website](https://deno.land/)
- [Deno Installation Guide](https://deno.land/#installation)
- [Deno Manual](https://deno.land/manual)