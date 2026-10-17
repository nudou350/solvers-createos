---
title: Figma connector (MCP server): tools and read limits
source: Figma developer documentation (MCP server tools)
source_url: https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/
source_date: 2026-10-02
valid_until: 2027-01-31
tags: [figma, mcp, connector, variables, reading]
---

## Read tools used in the audit

According to the Figma documentation: `get_design_context` delivers the design context of a layer or of the selection; `get_metadata` returns the structure (sparse XML) of a selection, useful for mapping frames without downloading everything; `get_screenshot` captures the selection; `get_variable_defs` brings the variables and styles used in the selection. `download_assets` exports images as PNG, JPG, SVG and PDF. The flow recommended in this Solver's steps is structure first (`get_metadata`), then context, variables and capture of the target frames only.

## Selection or link

The documentation distinguishes two server modes: the one installed in the desktop app accepts requests based on the user's current selection; the remote one requires explicit links to frames or layers. That is why you should always ask for the link with a `node-id` (right-click the frame, copy link to selection): it works in both modes and avoids scanning whole pages.

## Write tools

The connector also has write tools on the remote server, such as `use_figma` (create, edit, delete or inspect objects) and `generate_figma_design`. This Solver only writes to the user's file if they ask, for example to create the variable collections for the tokens, and it describes what it is going to create beforehand. For libraries and components there are `get_libraries` and `search_design_system` (remote server) and the mapping between Figma components and code components through `get_code_connect_map`.

## When the connector is not available

The list of available tools varies by conversation and by plan. If the Figma tools do not show up, follow the no-connector path (screenshots and values pasted from the inspect panel) and mark each value as read or estimated. Never invent the contents of a file that was not read.
