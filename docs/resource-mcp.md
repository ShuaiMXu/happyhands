# Design resource MCP

The stdio MCP exposes the same website resource catalog used by `happyhands resources`, including Design.md, design systems, component registry source, mobile tokens and platform guidelines. It adds no workbench, account or background service. The server only searches and reads; it never executes archived instructions, installs packages, modifies a product or records acceptance.

## Start

Use the installed runtime's actual absolute path:

```json
{
  "mcpServers": {
    "happyhands-resources": {
      "command": "node",
      "args": ["/absolute/path/to/happyhands/bin/happyhands.mjs", "mcp"]
    }
  }
}
```

This is a generic MCP client configuration; use the host's supported configuration format. A DSH host with stdio MCP support can launch the same command. Configuring the host is distinct from a dedicated DSH executor, model access, UI inspection or acceptance.

The default source is `https://happyhands.cc`. For an explicitly chosen website preview, append `--origin https://YOUR-PREVIEW.vercel.app`; loopback HTTP is supported for local integration tests. The tools cannot change this origin. HTTPS redirects, embedded credentials and arbitrary resource paths are rejected. An old deployment without the unified catalog falls back only on a real 404 to the three existing website indexes; server errors do not become empty results.

## Tools

- `search_design_resources`: a concrete query and optional type, platform, system, collection and result limit (1–20). Search metadata rather than loading the whole archive into a model.
- `get_design_resource`: exactly one returned ID, or an existing system's declared document. Reads full UTF-8 source up to 512 KiB and verifies the published SHA-256 when available. Returns original source, version, license notice, related resource IDs and installation metadata where supplied.

The original registry payload is source data. Read its real dependencies/API, target framework and license before adopting it. A supplied hosted URL does not prove a component compiles in every target. App token archives do not provide application-page structure; Mobbin's public integration docs do not include paid screenshots or flows.

## Connect to the remediation chain

1. Frame the actual user task and inspect source-bound before evidence. Preserve project rules and approved Foundation.
2. Search for the needed decision/pattern/component and platform. Read selected full source, not just a search title. Compare relevant system and guideline references instead of replacing the project's brand.
3. Freeze the **same returned ID** into the current Run with the existing command:

   `node /absolute/path/to/happyhands/bin/happyhands.mjs resources select --run RUN --id ID`

   Select an actual document when using a legacy system overview. Perform selection before the experience audit and formal diagnosis. When MCP explicitly uses a preview origin, pass that same `--origin` to `resources select` (and CLI search). The default remains the official website; no origin is silently inherited or changed by a tool result.
4. Before the audit, `experience --run RUN --phase context --step inspect` lists each selected snapshot's path and hash. Open the snapshot in the run directory and examine the section that bears on the task. Record its hash, section, application or rejection, and the behavior to preserve in the audit and design decision. Reading or selecting a resource never establishes approval.
5. Existing isolated repair, matched recapture, specialist verification, independent experience review and real human judgment follow. A resource lookup is not an improvement claim.

The MCP and CLI share index parsing, document reads and hash verification. No parallel reference store or acceptance ledger exists. Standard output is reserved for MCP protocol traffic; diagnostics go to standard error. The transport and real client tests use the official [MCP TypeScript SDK v1](https://ts.sdk.modelcontextprotocol.io/server).
