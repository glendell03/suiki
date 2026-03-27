/**
 * Shared mock data and wallet injection for E2E tests.
 *
 * - MOCK_ADDRESS: fake Sui wallet address used across all tests
 * - injectWallet(): injects a fake connected wallet into window before React loads
 * - mockSuiRpc(): intercepts SUI JSON-RPC calls and returns fixture data
 */

export const MOCK_ADDRESS =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab";

/** Inject a fake connected account so WalletGuard passes without a real wallet. */
export async function injectWallet(page: import("@playwright/test").Page) {
  await page.addInitScript((address: string) => {
    // dapp-kit-react reads from localStorage for persisted wallet state
    localStorage.setItem(
      "dapp-kit:wallet-connection-info",
      JSON.stringify({
        walletName: "Mock Wallet",
        connectionStatus: "connected",
        accounts: [{ address, publicKey: null, chains: ["sui:testnet"] }],
        currentWallet: { name: "Mock Wallet" },
        currentAccount: { address, publicKey: null, chains: ["sui:testnet"] },
      })
    );
    // Also set window.__suikiMockAccount so custom hooks can read it
    (window as Record<string, unknown>).__suikiMockAccount = { address };
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
