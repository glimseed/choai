# docs.choai.dev

The site that explains the app, to somebody who has not opened it.

**GPL-3.0-or-later, by choice.** Nothing here links against hledger, so nothing
here inherits hledger's licence — the app's copyleft does not reach this
directory. It is under the same terms because that is what this project wants
for everything it publishes, and the LICENSE at the root of the repository is
the one that says so.

It is still its own project: its own dependencies, its own build, its own
output, and no imports in either direction. Nothing about the licence changes
that, and it could still be lifted out into a repository of its own.

```sh
bun install
bun run dev     # :45720
bun run build   # -> dist, served at the root of docs.choai.dev
```

`PUBLIC_APP` in `.env` says where the app is, so a page built here links to the
published app and a page run here links to the one on this machine.
`PUBLIC_CF_BEACON` is the Cloudflare Web Analytics token; with it unset, no
counter is written into the page at all.
