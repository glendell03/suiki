<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:sui-agent-rules -->
# SUI / @mysten SDK Conventions

- Always prefer **`@mysten/dapp-kit-react` v2** for client-side wallet connection and transaction signing.
- Always use **`SuiGrpcClient` from `@mysten/sui/grpc`** for server-side RPC calls (API routes, Server Components). Never use the JSON-RPC `SuiClient` on the server.
- The shared server singleton lives in `src/lib/sui-client.ts` — import `suiClient` from there; do not instantiate new clients elsewhere.
- Before writing any SUI/Move interaction code, invoke the **`sui-dev-skills`** skill to get up-to-date patterns and best practices.
<!-- END:sui-agent-rules -->
