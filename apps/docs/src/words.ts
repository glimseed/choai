/**
 * What the page says, in each language it says it.
 *
 * English is the shape the others are checked against, as it is in the app, so a
 * language that forgets a line will not build. Nothing here is generated from
 * the app's own dictionary: this page speaks to someone who has not opened the
 * app yet, and that is a different job from labelling its buttons.
 */

export const en = {
  lang: "en",
  /** Where the same page is in the other language, and what to call it there. */
  other: { href: "/ja/", label: "日本語" },
  title: "hledger-pwa — your hledger journal, in the browser",
  description:
    "Keep hledger journals in a private GitHub repository, from a phone or a desktop. hledger itself does the accounting, compiled to WebAssembly. Free, without advertising.",
  tagline: "Your hledger journal, in the browser.",
  lead: "Plain-text accounting on a phone, kept in a private repository of your own. hledger itself does the accounting — the real thing, compiled to WebAssembly and running in the page.",
  open: "Open the app",
  aboutHledger: "New to hledger? Start here",
  points: [
    {
      heading: "hledger does the accounting",
      body: "Not a reimplementation. hledger-lib is compiled to WebAssembly and answers every question the screens ask, so the numbers are hledger's own and new releases can be followed.",
    },
    {
      heading: "The file is what is true",
      body: "Your journal stays the text file it is. Entries are appended, never rewritten; the text can be edited directly; and whatever this app does not understand is carried through untouched.",
    },
    {
      heading: "Nothing is uploaded",
      body: "There is no backend. The journal is read in the page and kept on the device. The only thing it talks to is GitHub, and only when you ask it to.",
    },
    {
      heading: "Kept in a private repository",
      body: "Sync to a private GitHub repository with a fine-grained token. Entries written on the phone are laid after entries written on the desktop; when both sides changed the same lines it says so rather than choosing a winner.",
    },
    {
      heading: "More than one set of books",
      body: "A company's and a household's are different files, so they are different books here — each with its own repository, switched from the corner of the window.",
    },
    {
      heading: "Free, and without advertising",
      body: "Nothing is served but static files, so it costs almost nothing to run and there is nothing to sell. No account here, no tracking.",
    },
  ],
  licenceHeading: "Licence",
  licence:
    "hledger-pwa is free software under the GNU General Public License, version 3 or later. It ships hledger compiled into its WebAssembly module, and hledger is under the same licence — which is why this is too.",
  hledgerCredit: "hledger is copyright Simon Michael and contributors.",
  licencesLink: "Every package and its licence",
  builtWith: "Built with hledger, GHC's WebAssembly backend, SolidJS and Astro.",
}

export type Words = typeof en

export const ja: Words = {
  lang: "ja",
  other: { href: "/", label: "English" },
  title: "hledger-pwa — hledger の帳簿を、ブラウザで",
  description:
    "hledger の帳簿を private な GitHub リポジトリに置いて、スマホからでもパソコンからでも。計算しているのは hledger 本体を WebAssembly にしたものです。無料、広告なし。",
  tagline: "hledger の帳簿を、ブラウザで。",
  lead: "プレーンテキスト会計を、スマホで。帳簿は自分の private リポジトリに置きます。計算しているのは hledger 本体 ── WebAssembly にして、このページの中で動かしています。",
  open: "アプリを開く",
  aboutHledger: "hledger を知らない方はこちら",
  points: [
    {
      heading: "計算しているのは hledger 本体",
      body: "作り直したものではありません。hledger-lib を WebAssembly にして、画面からの問い合わせに答えさせています。数字は hledger のもので、本家の更新にも追従できます。",
    },
    {
      heading: "ファイルが真実",
      body: "帳簿はテキストファイルのままです。仕訳は末尾に足すだけで書き換えません。テキストを直接編集もできます。このアプリが知らない記法も、そのまま素通しします。",
    },
    {
      heading: "どこにも送りません",
      body: "サーバーがありません。帳簿はページの中で読まれ、端末に保存されます。通信するのは GitHub だけ、しかもあなたが押したときだけです。",
    },
    {
      heading: "private リポジトリに置く",
      body: "fine-grained トークンで private リポジトリと同期します。スマホで書いた仕訳は、パソコンで書いた仕訳の後ろに並びます。同じ行を両方で書き換えていたときは、どちらかを勝たせずにそう告げます。",
    },
    {
      heading: "帳簿は何冊でも",
      body: "会社の帳簿と家計簿は別のファイルです。だからこのアプリでも別の帳簿として持ちます。それぞれに置き場所があり、画面の隅で切り替えられます。",
    },
    {
      heading: "無料、広告なし",
      body: "配っているのは静的ファイルだけなので、動かす費用がほとんどかかりません。売るものもありません。ここでの登録も、追跡もありません。",
    },
  ],
  licenceHeading: "ライセンス",
  licence:
    "hledger-pwa は GNU General Public License バージョン 3 以降のもとで公開されている自由ソフトウェアです。WebAssembly モジュールに hledger を組み込んでおり、hledger が同じライセンスであるため、これもそうなります。",
  hledgerCredit: "hledger の著作権は Simon Michael と貢献者にあります。",
  licencesLink: "すべてのパッケージとライセンス",
  builtWith: "hledger、GHC の WebAssembly バックエンド、SolidJS、Astro で作っています。",
}
