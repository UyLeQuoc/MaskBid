# Chainlink CRE Crypto Limitations (Javy WASM)

This document explains why we cannot perform RSA decryption directly within the Chainlink Convergence Runtime Environment (CRE) workflow and must rely on an external solver (Edge Function).

## Problem Context

During development, we attempted to move the auction solver logic directly into the CRE workflow (`apps/cre-workflow/auction-workflow/main.ts`) to decrypt the confidential bids. However, the CRE failed to decrypt the data.

## Why it Fails

The Chainlink CRE executes JavaScript workflows by compiling them to WebAssembly (WASM) using a runtime based on the **Javy** toolchain. This strict WASM sandbox introduces several limitations regarding cryptography:

1. **No Node.js Native Modules:** The CRE sandbox does not support Node.js built-ins like the `crypto` module. Standard operations like `crypto.privateDecrypt` will throw errors because the underlying C++ native bindings cannot run in the WASM environment.
2. **Web Crypto API Absence:** While some modern WASM JS runtimes are adding support for `globalThis.crypto.subtle`, the specific Javy-based environment powering the CRE either lacks this API entirely or lacks support for complex asymmetric operations like RSA-OAEP decryption.

3. **Size and Memory Constraints of Pure JS Implementations:**
   - Trying to work around the missing native APIs by importing a pure-JavaScript cryptography library (like `node-forge` or `jsencrypt`) introduces massive amounts of code.
   - Javy has to bundle this entire library into the WASM binary.
   - The resulting WASM blob easily exceeds the strict payload size limits of the Chainlink DON.
   - Furthermore, pure JS RSA decryption is computationally heavy and often exceeds the CPU/memory execution time limits (gas limits) of a single CRE workflow execution.

## The Solution

Because the CRE WASM environment cannot efficiently or natively handle RSA decryption, we use the architecture outlined in `CLAUDE.md`:

```
Chainlink CRE (ConfidentialHTTP)
         ↓
Supabase Edge Function (solver)
```

1. The CRE workflow securely fetches the encrypted bids from the database.
2. It uses `Chainlink.fetch()` with `encryptOutput: true` to send the payload to the external **Solver Edge Function**.
3. Because the Edge Function runs in a Deno sandbox (not Javy WASM), it has full access to Web Crypto APIs and can perform the RSA decryption efficiently.
4. The VaultDON manages the `SOLVER_AUTH_TOKEN` securely to ensure only authorized CRE nodes can call the solver.

This separation of concerns allows us to maintain confidentiality (the decrypted bids are never exposed on-chain until the winner is selected) while working within the technical limitations of the CRE WASM runtime.
