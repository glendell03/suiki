/**
 * Shared mock data and wallet injection for E2E tests.
 *
 * - MOCK_ADDRESS: fake Sui wallet address used across all tests
 * - injectWallet(): injects a fake connected wallet into window before React loads
 * - mockSuiRpc(): intercepts SUI JSON-RPC calls and returns fixture data
 */

export const MOCK_ADDRESS =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab";

/**
 * Inject a fake connected account so WalletGuard passes without a real wallet.
 *
 * Strategy:
 *  1. Set the dapp-kit-core localStorage key so autoConnectWallet will try to
 *     reconnect.  The format is: `walletName:address:intents:` (intents empty).
 *  2. Register a minimal mock wallet via the wallet-standard event mechanism so
 *     the auto-connect lookup finds an existing account and skips the silent
 *     re-connect RPC call.
 */
export async function injectWallet(page: import("@playwright/test").Page) {
  await page.addInitScript((address: string) => {
    const WALLET_NAME = "E2E Mock Wallet";

    // ── 1. Prime the auto-connect storage key ─────────────────────────────
    // dapp-kit-core DEFAULT_STORAGE_KEY = "mysten-dapp-kit:selected-wallet-and-address"
    // Value format: `${walletUniqueIdentifier}:${address}:${intents}:`
    // walletUniqueIdentifier = wallet.id ?? wallet.name  (we use name)
    localStorage.setItem(
      "mysten-dapp-kit:selected-wallet-and-address",
      `${WALLET_NAME}:${address}::`
    );

    // ── 2. Register a mock Wallet Standard wallet ──────────────────────────
    // The wallet-standard `getWallets()` call dispatches "wallet-standard:app-ready"
    // and listens for "wallet-standard:register-wallet".  We fire the register
    // event so our mock is available when syncRegisteredWallets runs.
    const mockAccount = {
      address,
      publicKey: new Uint8Array(32),
      chains: ["sui:testnet"],
      features: ["sui:signTransaction", "sui:signPersonalMessage"],
      label: undefined,
      icon: undefined,
    };

    const mockWallet = {
      id: WALLET_NAME,
      name: WALLET_NAME,
      version: "1.0.0",
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
      chains: ["sui:testnet"],
      accounts: [mockAccount],
      features: {
        "standard:connect": {
          version: "1.0.0",
          connect: async () => ({ accounts: [mockAccount] }),
        },
        "standard:disconnect": {
          version: "1.0.0",
          disconnect: async () => {},
        },
        "standard:events": {
          version: "1.0.0",
          on: () => () => {},
        },
        "sui:signTransaction": {
          version: "2.0.0",
          signTransaction: async () => ({ bytes: "", signature: "" }),
        },
        "sui:signPersonalMessage": {
          version: "1.1.0",
          signPersonalMessage: async () => ({ bytes: "", signature: "" }),
        },
      },
    };

    // Register via the wallet-standard event API used by @wallet-standard/app
    try {
      window.dispatchEvent(
        new CustomEvent("wallet-standard:register-wallet", {
          detail: (api: { register: (w: unknown) => void }) => {
            api.register(mockWallet);
          },
        })
      );
    } catch {
      // Fallback: also try the app-ready listener path
    }

    // Also listen for future app-ready dispatches (if getWallets hasn't been
    // called yet when this script runs).
    window.addEventListener("wallet-standard:app-ready", (event) => {
      try {
        const e = event as CustomEvent<{ register: (w: unknown) => void }>;
        e.detail.register(mockWallet);
      } catch {
        // ignore
      }
    });
  }, MOCK_ADDRESS);
}

/** Mock SUI RPC responses for card and program data. */
export async function mockSuiRpc(page: import("@playwright/test").Page) {
  await page.route("**/fullnode.testnet.sui.io**", async (route) => {
    const request = route.request();
    let body: { method?: string } = {};
    try {
      body = JSON.parse(request.postData() ?? "{}");
    } catch {
      // ignore parse errors
    }

    if (body.method === "suix_queryEvents") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            data: [
              {
                id: { txDigest: "mockTx1", eventSeq: "0" },
                packageId: "0xmockpkg",
                transactionModule: "stamp_card",
                sender: MOCK_ADDRESS,
                type: "0xmockpkg::stamp_card::CardIssued",
                parsedJson: {
                  card_id: "0xcardid111",
                  customer: MOCK_ADDRESS,
                  program_id: "0xprog111",
                },
                timestampMs: "1711400000000",
              },
            ],
            nextCursor: null,
            hasNextPage: false,
          },
        }),
      });
    } else if (body.method === "sui_multiGetObjects") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: [
            {
              data: {
                objectId: "0xcardid111",
                version: "1",
                digest: "mockDigest",
                content: {
                  dataType: "moveObject",
                  fields: {
                    id: { id: "0xcardid111" },
                    program_id: "0xprog111",
                    customer: MOCK_ADDRESS,
                    current_stamps: 3,
                    stamps_required: 10,
                    last_stamped: 1711400000000,
                    merchant_name: "Mang Juan's Bakery",
                    merchant_logo: "",
                    reward_description: "Free pandesal",
                  },
                },
              },
            },
          ],
        }),
      });
    } else if (body.method === "sui_getObject") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            data: {
              objectId: "0xprog111",
              version: "1",
              digest: "mockDigest",
              content: {
                dataType: "moveObject",
                fields: {
                  id: { id: "0xprog111" },
                  name: "Mang Juan's Bakery",
                  logo_url: "",
                  stamps_required: 10,
                  total_issued: 42,
                  owner: MOCK_ADDRESS,
                  reward_description: "Free pandesal",
                },
              },
            },
          },
        }),
      });
    } else {
      // Pass through or return a generic empty response
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: null,
        }),
      });
    }
  });
}
