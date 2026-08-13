# docs.hledger-pwa.app

The site that explains the app, to somebody who has not opened it.

**MIT, not GPL.** It shares no code with the app: nothing here is linked
against hledger, so nothing here inherits hledger's licence. It sits in the same
repository for convenience — beside the app rather than inside it, which is
where Vite keeps its own site — and is built on its own, with its own
dependencies, into its own directory. The GPL at the root of this repository covers the app
and the engine; this directory carries its own LICENSE and that is the one that
applies to it.

```sh
npm install
npm run dev     # :45720
npm run build   # -> dist, served at the root of docs.hledger-pwa.app
```

`PUBLIC_APP` in `.env` says where the app is, so a page built here links to the
published app and a page run here links to the one on this machine.
