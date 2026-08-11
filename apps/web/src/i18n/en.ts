/**
 * English, and the shape every other language must have.
 *
 * `Dictionary` is taken from this object, so a language missing a key — or
 * inventing one — is a type error rather than a blank on screen.
 *
 * What is deliberately absent: account names, amounts and dates. Those belong to
 * the journal, and hledger already formats amounts to the styles declared in it,
 * so translating them here would put the screen at odds with the file.
 */
export const en = {
  app: {
    name: "hledger-pwa",
  },
  nav: {
    journal: "Journal",
    balanceSheet: "Balance sheet",
    incomeStatement: "Income statement",
    accounts: "Accounts",
    settings: "Settings",
    showPanels: "Show sidebars",
    hidePanels: "Hide sidebars",
  },
  journal: {
    queryPlaceholder: "hledger query, eg  acct:food date:2026-02",
    transactionCount: "{{ count }} txns",
    date: "Date",
    description: "Description",
    postings: "Postings",
    reading: "Reading…",
    nothingMatches: "nothing matches",
    range: "{{ from }}–{{ to }} of {{ total }}",
    newer: "Newer",
    older: "Older",
  },
  welcome: {
    heading: "No journal open",
    body: "Everything runs here in the browser — hledger itself, compiled to WebAssembly. Nothing you open is uploaded anywhere.",
    openFiles: "Open journal files",
    tryDemo: "Try the demo",
    starting: "Starting hledger…",
    demoLabel: "demo journal",
  },
  balanceSheet: {
    lead: "What you own and owe, as of today. Assets, liabilities and equity, accumulated from the beginning of the journal.",
    empty: "No asset, liability or equity accounts.",
  },
  incomeStatement: {
    lead: "What came in and what went out over a period. Revenue and expenses, as a change rather than a running balance.",
    empty: "Nothing in this period.",
    thisMonth: "This month",
    thisYear: "This year",
    lastYear: "Last year",
    allTime: "All time",
  },
  accounts: {
    lead: "Every account in the journal, with its balance.",
    empty: "No accounts yet.",
    all: "All accounts",
    noJournal: "No journal open.",
    panelTitle: "Accounts",
  },
  report: {
    total: "Total",
    working: "Working…",
    needsJournal: "Open a journal first.",
  },
  shortcuts: {
    title: "Keyboard shortcuts",
    compose: "Write an entry",
    togglePanels: "Show or hide the sidebars",
    close: "Close the panel",
  },
  settings: {
    language: "Language",
    languageHint: "Chosen from your browser unless you pick one here.",
  },
  compose: {
    title: "New entry",
    open: "New entry",
    close: "Close",
    date: "Date",
    payee: "Payee",
    payeeHint: "who it was with",
    note: "Note",
    noteHint: "what it was about (optional)",
    tags: "Tags",
    postingTags: "Tags on this posting",
    tagName: "name",
    tagValue: "value",
    addTag: "+ tag",
    removeTag: "Remove tag",
    postings: "Postings",
    account: "account",
    amount: "amount",
    addPosting: "+ another posting",
    willBeWritten: "What gets written",
    hledgerFillsTheRest: "The posting left blank is worked out by hledger.",
    add: "Add to journal",
    download: "Download journal",
  },
  /** Why something did not work. The wording is chosen here, not passed up. */
  trouble: {
    noJournal: "No journal is open yet.",
    fileMissing: "{{ path }} is not among the files given.",
    readFailed: "This journal could not be read.",
    malformedRequest: "hledger did not understand that.",
    unknownReport: "There is no {{ report }} report.",
    missingTransaction: "No transaction was given to write.",
    crashed: "hledger stopped part way through.",
    unreachable: "hledger could not be reached.",
    unreadableAnswer: "hledger answered with something unreadable.",
    /** Recognised from hledger's own wording; see hledger/diagnose.ts. */
    unbalancedTransaction: "A transaction does not balance.",
    balanceAssertion: "A balance assertion does not hold.",
    syntax: "This journal has a syntax error.",
    unknownAccount: "An account is used without being declared.",
    unknownCommodity: "A commodity is used without being declared.",
    unparseableDate: "That date could not be read.",
    unparseableQuery: "That query could not be read.",
    unparseableAmount: "That amount could not be read.",
    /** hledger's own words, which stay as they came. */
    detailFromHledger: "What hledger said",
  },
}

export type Dictionary = typeof en
