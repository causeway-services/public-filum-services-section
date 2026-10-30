# @561-group/filum.561.group

filum.561.group — THE newscable's sheath. A newscable is a NEW thing whose
data IS newswires: a bundle of wires the way a cable is a bundle of wires.
This package is only the sheath — the `"561:newscable"` block (title,
description, port 18804, domain, routing `subdomain`) and the proxy
entries. It holds no wires, no stores, and no producers.

**Membership is discovered, not declared.** Being
`sites/<name>.filum.561.group` with a `"561:newswire"` block in its
package.json IS being on the cable: `@561-group/newscable` finds the
sibling directories under `sites/` matching `*.filum.561.group`, takes the
wire's name from the directory name, and serves each wire's own
`backstage/store/` through the wire's own surfaces. There is no wires array
to keep in sync.

## The members

| wire | package |
| --- | --- |
| [arithmomantia](https://arithmomantia.filum.561.group/) | `sites/arithmomantia.filum.561.group` |
| [astrologia](https://astrologia.filum.561.group/) | `sites/astrologia.filum.561.group` |
| [cartomantia](https://cartomantia.filum.561.group/) | `sites/cartomantia.filum.561.group` |
| [lectio](https://lectio.filum.561.group/) | `sites/lectio.filum.561.group` |
| [rete-agentium](https://rete-agentium.filum.561.group/) | `sites/rete-agentium.filum.561.group` |

The sheath serves the HTML index, `/cable.json` (the agent-readable
directory: every wire's masthead, surface URLs, and freshness),
`/robots.txt`, and `/sitemap.xml` at the apex; each wire's h-feed, canonical
bundles (`/items/<subject>.json`), h-entries, RSS/Atom/JSON Feed,
corrections, and audit live under its subdomain.

## Operation

Only THIS package is run as a service: the six `"561:sites"` entries (apex
plus five wire subdomains) all proxy to the one listener on port 18804, and
systemd runs only `filum-newscable`. The wires run inside it.

```sh
pnpm run serve              # the cable: discover members, one listener
pnpm run verify             # tsc --noEmit + discovery over the real tree
```

```cron
@reboot cd /home/emsenn/561-group/sites/filum.561.group && pnpm run serve >> backstage/serve.log 2>&1
```

Per-wire producer crons live in the wire sites themselves (each runs
`pnpm run assert` daily at 01:30 in its own directory) — writing a wire's
store is the wire's own affair.
