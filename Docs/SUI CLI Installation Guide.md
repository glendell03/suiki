# SUI CLI Installation Guide for macOS

**Last Updated:** March 25, 2026
**Tested On:** macOS Monterey or newer (Apple Silicon M1/M2/M3 and Intel)
**Official Docs:** [https://docs.sui.io/guides/developer/getting-started/sui-install](https://docs.sui.io/guides/developer/getting-started/sui-install)

---

## Quick Summary

There are three primary ways to install the SUI CLI on macOS:

| Method | Recommended | Speed | Multi-Tool Support | Fish Shell |
|--------|------------|-------|-------------------|-----------|
| **suiup** | ✓ Yes | Fast | Yes (walrus, mvr, etc.) | Native support |
| **Homebrew** | Alternative | Slower | No | Native support |
| **Build from Source** | Advanced | Very slow | No | Native support |

**For most users on macOS, we recommend `suiup` (Method 1).** It's the official installer, supports version management, and integrates other Sui stack tools.

---

## Method 1: Install via suiup (Recommended)

### Step 1: Install suiup

Run the official installation script:

```bash
curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh
```

This installs `suiup` itself (the version manager) to your system.

### Step 2: Install Sui CLI

```bash
suiup install sui@testnet
```

**Supported versions:**
- `sui@testnet` - Latest testnet release (recommended for development)
- `sui@devnet` - Latest devnet release
- `sui@mainnet` - Latest mainnet release
- `sui@testnet-1.40.1` - Specific version (example)

### Step 3: Configure PATH for Fish Shell

suiup stores binaries in `~/.local/bin` on macOS. You must add this to your PATH.

**Check your PATH is configured:**

```bash
echo $PATH | grep ".local/bin"
```

If it's not there, add it. Since you use Fish shell, edit `~/.config/fish/config.fish`:

```bash
nano ~/.config/fish/config.fish
```

Add this line:

```fish
fish_add_path ~/.local/bin
```

Save (Ctrl+O, Enter, Ctrl+X in nano). Then reload:

```bash
source ~/.config/fish/config.fish
```

Or simply open a new terminal window.

### Step 4: Verify Installation

```bash
sui --version
```

Expected output: `sui 1.xx.x` (version number)

```bash
sui client --help
```

Should display the Sui client command options.

### Switching Versions

suiup makes it easy to switch between versions:

```bash
suiup install sui@mainnet-1.60.0  # Install specific version
suiup default sui mainnet-1.60.0  # Switch to that version
sui --version                      # Verify
```

List available versions:

```bash
suiup list sui
```

---

## Method 2: Install via Homebrew

### Prerequisites

You must have Homebrew installed:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Installation

```bash
brew install sui
```

**⚠️ Caveats:**
- Installation may take several minutes if Sui prerequisites (Rust, CMake, etc.) aren't already installed
- **Does NOT support version switching** - suiup is better for this
- **Does NOT install related tools** (walrus, mvr, move-analyzer) - those must be installed separately
- Homebrew formula may lag behind the latest Sui releases

### Check What Version You Get

```bash
brew info sui
```

This shows the version Homebrew will install (typically 1-2 versions behind latest).

### PATH Configuration

Homebrew typically installs binaries to `/usr/local/bin` (Intel Macs) or `/opt/homebrew/bin` (Apple Silicon), which are usually already in your PATH.

Verify:

```bash
which sui
```

If you get no output, add to `~/.config/fish/config.fish`:

```fish
# For Apple Silicon (default on modern Macs)
fish_add_path /opt/homebrew/bin

# For Intel Macs
fish_add_path /usr/local/bin
```

Then reload:

```bash
source ~/.config/fish/config.fish
```

---

## Method 3: Build from Source

This is for advanced developers who want the absolute latest development build.

### Prerequisites

First, install Rust and Cargo:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Then update to latest stable:

```bash
rustup update stable
```

Install additional macOS dependencies via Homebrew:

```bash
brew install cmake libpq
```

Verify installations:

```bash
rustc --version
cargo --version
cmake --version
```

### Build Sui

Clone and build from source:

```bash
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
```

**Branch options:**
- `testnet` - Current testnet branch (recommended)
- `devnet` - Development branch (cutting-edge, unstable)
- `mainnet` - Production mainnet (stable)

This compiles Sui and installs the binary to `~/.cargo/bin`.

### Add to PATH

Verify cargo is in your PATH:

```bash
echo $PATH | grep ".cargo/bin"
```

If not, add to `~/.config/fish/config.fish`:

```fish
fish_add_path ~/.cargo/bin
```

Reload:

```bash
source ~/.config/fish/config.fish
```

### Build Time

Expect 10-20 minutes depending on your Mac's CPU and available dependencies. Apple Silicon Macs (M1/M2/M3) will compile faster than Intel Macs.

---

## Verifying Your Installation

### Check Version

```bash
sui --version
```

### Check Client Setup

```bash
sui client --help
```

### List Available Commands

```bash
sui --help
```

### Verify Move Build Tools

```bash
sui move --help
```

---

## Move 2024.beta Edition Support

The Suiki project uses Move 2024.beta edition (see `Move.toml`). The current SUI CLI has full support for Move 2024.beta.

### Verify Move Build

After installing Sui CLI, test it with the Suiki Move package:

```bash
cd /path/to/suiki
sui move build
```

**Expected output:**
```
BUILDING Suiki
Compiling dependencies...
Compiling Suiki...
BUILDING Modules:
 - 0x0::suiki
```

**If you get an "unsupported edition" error:**
- You have an older version of Sui CLI that predates Move 2024 support
- Upgrade: `suiup install sui@testnet` (or your chosen version)

### Move 2024 Features

Your projects can now use:
- **Macros** - Syntactic macros for cleaner code
- **Enums** - Pattern matching support
- **Enhanced loops** - Loop tags for break/continue control
- **Stricter typing** - Better compile-time guarantees

No migration needed if you're already using Move 2024.beta in your `Move.toml`.

---

## macOS-Specific Considerations

### Apple Silicon (M1/M2/M3) vs Intel

**Good news:** SUI CLI officially supports both architectures.

- **Apple Silicon (ARM64)**: Native compilation - best performance and battery life
- **Intel (x86_64)**: Native compilation - full support

Both suiup and Homebrew automatically detect your architecture and download the correct binary.

**Performance:** Native ARM64 binaries on Apple Silicon are 20-30% faster than running through Rosetta 2 translation.

### Checking Your Mac Architecture

```bash
uname -m
```

Output:
- `arm64` = Apple Silicon (M1, M2, M3, etc.)
- `x86_64` = Intel processor

### macOS Monterey or Newer Required

- **Monterey (12.x)**: ✓ Supported
- **Ventura (13.x)**: ✓ Supported
- **Sonoma (14.x)**: ✓ Supported
- **Sequoia (15.x)**: ✓ Supported
- **Older versions**: ✗ Not supported

### Gatekeeper Security Warnings

If you see "cannot be opened because the developer cannot be verified":

```bash
xattr -d com.apple.quarantine ~/.local/bin/sui
```

Or in System Preferences → Security & Privacy, click "Open Anyway" for the Sui binary.

This is normal for downloaded binaries and safe to bypass.

---

## Fish Shell Configuration

Since you use Fish shell, here's the complete PATH setup for Suiki development:

### Complete Fish Config Setup

Edit `~/.config/fish/config.fish`:

```bash
nano ~/.config/fish/config.fish
```

Add these lines (if not already present):

```fish
# Add suiup/local binaries to PATH
fish_add_path ~/.local/bin

# Add Rust/Cargo to PATH (if building from source)
fish_add_path ~/.cargo/bin

# Add Homebrew binaries (for Apple Silicon)
fish_add_path /opt/homebrew/bin

# Add MacPorts if used
fish_add_path /opt/local/bin
```

Save and reload:

```bash
source ~/.config/fish/config.fish
```

### Verify PATH

```bash
echo $PATH
```

Look for `~/.local/bin` or `/opt/homebrew/bin` in the output (order matters - earlier entries are searched first).

### Fish-Specific Tips

- Use `fish_add_path -m` to move a path to the beginning (highest priority)
- Use `fish_add_path -a` to append to the end (lowest priority)
- Universal variables are stored in `~/.local/share/fish/fish_variables` (you rarely need to edit this)
- Changes made with `fish_add_path` persist automatically

---

## Common Issues & Solutions

### Issue: "command not found: sui"

**Cause:** Sui binaries not in PATH

**Solution:**

```bash
# Check if suiup installed correctly
ls ~/.local/bin/sui

# If file exists, verify PATH
echo $PATH | grep ".local/bin"

# If missing from PATH, add it
fish_add_path ~/.local/bin
source ~/.config/fish/config.fish

# Test
sui --version
```

### Issue: "sui move build" fails with "unsupported edition"

**Cause:** Sui CLI version predates Move 2024.beta support

**Solution:**

Update to latest version:

```bash
suiup install sui@testnet -y
sui --version  # Should be v1.40.0 or later
cd /path/to/suiki && sui move build
```

### Issue: Homebrew installation takes 30+ minutes

**Cause:** Building from source because Sui isn't pre-compiled in the formula

**Solution:**

Cancel (Ctrl+C) and use suiup instead:

```bash
brew uninstall sui  # Optional
curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh
suiup install sui@testnet
```

suiup provides pre-compiled binaries and is 5-10x faster.

### Issue: Wrong architecture installed

**Cause:** Running non-native architecture through Rosetta 2

**Verify:**

```bash
file ~/.local/bin/sui
```

Output should show your architecture:
- `Mach-O 64-bit executable arm64` (Apple Silicon native - good)
- `Mach-O 64-bit executable x86_64` (Intel binary - also fine, but slower on Apple Silicon)

**Fix:**

Reinstall targeting correct architecture:

```bash
suiup list sui  # Shows available versions
suiup install sui@testnet -y  # Auto-detects your arch
```

---

## SUI Testnet Faucet

To deploy contracts and test on testnet, you need testnet SUI tokens.

### Official Faucet

**Web Faucet:** [https://faucet.sui.io/](https://faucet.sui.io/)

1. Visit the link in your browser
2. Select "Testnet" from the network dropdown
3. Paste your Sui address
4. Click "Request SUI"

Tokens appear in 1-2 minutes.

### Command Line Faucet

```bash
curl --location --request POST 'https://faucet.testnet.sui.io/gas' \
  --header 'Content-Type: application/json' \
  --data-raw '{"FixedAmountRequest":{"recipient":"YOUR_SUI_ADDRESS"}}'
```

Replace `YOUR_SUI_ADDRESS` with your address (e.g., `0x1234abcd...`).

### Community Faucets

Alternative faucets with separate rate limits:

- [Blockbolt Faucet](https://faucet.blockbolt.io/) - 0.5 SUI per request
- [Triangle Platform Faucet](https://faucet.triangleplatform.com/sui/testnet) - 1 SUI per request
- [Stakely Faucet](https://stakely.io/faucet/sui-testnet-sui) - 1 SUI per request
- [n1stake Faucet](https://faucet.n1stake.com/) - 0.5 SUI instantly

### Rate Limiting

- Official faucet: ~1 request per few hours per address
- Community faucets: Vary by provider, often 1 per day

### Getting Your Sui Address

```bash
sui client addresses
```

Your address appears as:
```
<ALIAS>          | <ADDRESS>
─────────────────┼──────────────────────────────────
default          | 0x123456789abcdef...
```

---

## Configuration Files

After installing Sui, configuration files are created at:

- **Config directory:** `~/.sui/sui_config/`
- **Main config:** `~/.sui/sui_config/client.yaml`

### client.yaml Contains

- Network environment details (Mainnet, Testnet, Devnet, Localnet)
- Active network (which network CLI commands target)
- Active address (which address you sign transactions from)
- Keystore location (where private keys are stored)

### Viewing Current Configuration

```bash
sui client active-env
```

Output:
```
Using network config [testnet]
Rpc URL: https://fullnode.testnet.sui.io:443
```

### Switch Networks

```bash
sui client switch --env testnet    # Testnet (recommended for development)
sui client switch --env devnet     # Devnet (latest features, unstable)
sui client switch --env mainnet    # Mainnet (production)
sui client switch --env localnet   # Local Sui network
```

---

## Testing Your Installation with Suiki

### 1. Verify Sui CLI

```bash
sui --version
sui client --help
```

### 2. Build the Suiki Move Package

```bash
cd /path/to/suiki/Suiki
sui move build
```

Expected output:
```
BUILDING Suiki
Compiling dependencies...
Compiling Suiki...
BUILDING Modules:
 - 0x0::suiki
```

### 3. Check Your Sui Address

```bash
sui client active-address
```

### 4. Get Testnet Tokens

```bash
# Get your address first
ADDR=$(sui client active-address)

# Request tokens from faucet
curl --location --request POST 'https://faucet.testnet.sui.io/gas' \
  --header 'Content-Type: application/json' \
  --data-raw "{\"FixedAmountRequest\":{\"recipient\":\"$ADDR\"}}"
```

### 5. Check Your Balance

```bash
sui client balance
```

Wait 1-2 minutes after requesting faucet tokens, then check again.

### 6. Ready to Deploy

Once you have SUI balance, you can deploy Suiki:

```bash
cd /path/to/suiki/Suiki
sui client publish --gas-budget 10000000
```

---

## Troubleshooting Checklist

- [ ] Ran `suiup install sui@testnet` or equivalent
- [ ] Verified `sui --version` returns a version number
- [ ] Added `~/.local/bin` to fish PATH using `fish_add_path`
- [ ] Reloaded fish config with `source ~/.config/fish/config.fish`
- [ ] Ran `sui move build` successfully in Suiki directory
- [ ] Got testnet SUI from faucet
- [ ] Verified address with `sui client active-address`
- [ ] Checked balance with `sui client balance`

If still having issues:

```bash
# Complete diagnostic
echo "=== Architecture ===" && uname -m
echo "=== Sui Version ===" && sui --version
echo "=== Sui Path ===" && which sui
echo "=== PATH ===" && echo $PATH
echo "=== Move Test ===" && cd /path/to/suiki && sui move build
```

Share this output in the [Sui Discord](https://discord.gg/sui) #general or #developers channel for help.

---

## References

| Resource | URL |
|----------|-----|
| Official Install Guide | [https://docs.sui.io/guides/developer/getting-started/sui-install](https://docs.sui.io/guides/developer/getting-started/sui-install) |
| suiup Repository | [https://github.com/MystenLabs/suiup](https://github.com/MystenLabs/suiup) |
| Sui CLI Reference | [https://docs.sui.io/references/cli](https://docs.sui.io/references/cli) |
| Sui Move CLI | [https://docs.sui.io/references/cli/move](https://docs.sui.io/references/cli/move) |
| Build from Source | [https://docs.sui.io/guides/developer/getting-started/install-source](https://docs.sui.io/guides/developer/getting-started/install-source) |
| Move 2024 Migration | [https://docs.sui.io/guides/developer/advanced/move-2024-migration](https://docs.sui.io/guides/developer/advanced/move-2024-migration) |
| Fish Shell Docs | [https://fishshell.com/docs/current/](https://fishshell.com/docs/current/) |
| Sui Testnet Faucet | [https://faucet.sui.io/](https://faucet.sui.io/) |
| Sui Documentation | [https://docs.sui.io/](https://docs.sui.io/) |

---

## Quick Start (TL;DR)

```bash
# Install suiup
curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh

# Install Sui
suiup install sui@testnet

# Add to PATH (Fish shell)
fish_add_path ~/.local/bin
source ~/.config/fish/config.fish

# Verify
sui --version

# Test with Suiki
cd /path/to/suiki/Suiki
sui move build

# Get testnet tokens
curl --location --request POST 'https://faucet.testnet.sui.io/gas' \
  --header 'Content-Type: application/json' \
  --data-raw "{\"FixedAmountRequest\":{\"recipient\":\"$(sui client active-address)\"}}"

# Check balance (after 1-2 minutes)
sui client balance
```

Done! Your Sui environment is ready for Suiki development.
