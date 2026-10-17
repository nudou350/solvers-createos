---
title: CreateOS Sandbox limits, plans, shapes and rootfs images
source: CreateOS Sandbox docs (Limits and defaults, Concepts, Overview) and the Sandbox pricing page
source_url: https://createos.sh/docs/Sandbox/Limits
source_date: 2026-10-17
valid_until: 2027-01-15
trial: true
tags: [createos, sandbox, limits, plans, shapes, rootfs, devbox, pricing]
---

## Plans (concurrent sandboxes and creations per rolling 24 hours)

| Plan | Concurrent | Created per 24 h | Disks | Templates | Max disk | Largest shape |
|---|---|---|---|---|---|---|
| Free | 1 | 10 | 0 | 0 | 10 GiB | 1 vCPU / 1 GB |
| Beginner | 5 | 50 | 5 / 50 | 5 / 50 | 30 GiB | 4 vCPU / 4 GB |
| Pro | 20 | 200 | 20 / 200 | 20 / 200 | 50 GiB | 8 vCPU / 8 GB |
| Enterprise | 30 | 300 | 30 / 300 | 30 / 300 | 60 GiB | 8 vCPU / 16 GB |

- The concurrent cap "counts every sandbox that is not destroyed or failed: paused ones count". A create over the cap **fails with `429`**, it does not queue.
- The daily cap counts sandboxes created in the rolling last 24 hours, destroyed ones included.
- There is no maximum lifetime: a sandbox runs until it is destroyed, paused or auto-paused.
- Same per-second rate on every plan; plans differ in limits and top-up credits. New accounts start with 500 free credits. Paused sandboxes are billed for memory and storage, not vCPU. No egress fees.

What this means for a Solvers session: one sandbox per user session, reused across steps, created on the first `sandbox_run`. Never ask the user to open more sandboxes; if a tool answers that the plan limit was reached, tell the user and wait, do not loop.

## Shapes

`GET /v1/shapes` is the source of truth. Documented shapes: `s-0.25vcpu-512mb`, `s-0.5vcpu-1gb`, `s-1vcpu-256mb`, `s-1vcpu-1gb`, `s-1vcpu-2gb`, `s-2vcpu-2gb`, `s-2vcpu-4gb`, `s-4vcpu-4gb`, `s-4vcpu-8gb`; default disk 10 GiB, raised with `disk_mib` up to the plan's max. No GPU shapes. Solvers uses `s-1vcpu-1gb` (the largest on Free). With 1 GB of RAM, avoid heavy builds (large Next.js or webpack builds can run out of memory); prefer small Express or Fastify services.

## Rootfs images

| Image | Contents |
|---|---|
| `devbox:1` | Ubuntu 24.04 LTS, Python 3.12 with `pip` and `uv`, Node.js 24, Bun 1.4, Go 1.26, Rust 1.83, Docker 29, SSH, about 374 packages (pandas, numpy, ...), five coding-agent CLIs |
| `desktop:1` | Graphical desktop (XFCE, Chrome) with computer-use APIs |
| `ubuntu:26.04` | Ubuntu 26.04 LTS, minimal |
| `debian:13` | Debian 13, minimal |
| `alpine:3.20` | Alpine 3.20, minimal; the **catalog default** when `rootfs` is omitted |

Solvers always asks for `devbox:1`, so `node`, `npm`, `python3`, `bun`, `go`, `cargo`, `curl` and `git` are already there: never spend a run installing Node or Python.

## Other limits

- Buffered `exec` output: 1 MiB (the Solvers tool returns about 16 KB per stream, marked `truncated`).
- Managed process output: 1 MiB per process, 32 MiB per sandbox.
- Environment variables: up to 64 keys, 4 KiB per value, 64 KiB total.
- Bandwidth: 50 GiB per sandbox by default.
- Auto-pause: off by default; `auto_pause_after_seconds` between 60 and 86,400. Solvers sets 300 s, so a paused sandbox resumes on the next call with the files and installed `node_modules` still there.

## Regions and endpoints

The docs list the control plane as `https://api.sb.createos.sh` with `region` `eu` or `us` matching the control plane; this team's deployment uses the EU endpoint `https://api-eu.sb.createos.sh`. SSH gateway: `gateway.sb.createos.sh:2222`.

## Notes on conflicting statements

The Concepts page describes `devbox:1` as Debian-based and the default; the Limits page says Ubuntu 24.04 and that `alpine:3.20` is the default. Trust the Limits page and check with `cat /etc/os-release` when it matters.
