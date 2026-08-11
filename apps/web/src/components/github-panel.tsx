import { For, Show, createResource, createSignal, type JSX } from "solid-js"

import { Button } from "~/components/ui/button"
import { TextField, TextFieldInput } from "~/components/ui/text-field"
import { TroubleNote } from "~/components/trouble-note"
import { connect, connection, disconnect, type Connection } from "~/github/kept"
import { whoami, type Failure } from "~/github/api"
import { pull, push, type Outcome, type Snag } from "~/github/sync"
import { journal } from "~/journal/store"
import { getOrUndefined } from "~/lib/monad"
import { t } from "~/i18n"

const EMPTY: Connection = { owner: "", repo: "", branch: "", path: "", token: "" }

/**
 * The repository the books live in.
 *
 * The token is typed here and goes to this browser's own storage and to
 * api.github.com, nowhere else — which is said on the page, since a box asking
 * for a token deserves to say where it goes.
 */
export function GitHubPanel(): JSX.Element {
  const [kept, { refetch }] = createResource(connection)
  const [edited, setEdited] = createSignal<Connection | undefined>(undefined)
  const [busy, setBusy] = createSignal(false)
  const [said, setSaid] = createSignal<string | undefined>(undefined)
  const [snag, setSnag] = createSignal<Snag | undefined>(undefined)

  /** What is in the boxes: what is being typed, or what was saved. */
  const settings = (): Connection => edited() ?? kept() ?? EMPTY
  const change = (part: Partial<Connection>): void => {
    setEdited({ ...settings(), ...part })
  }

  const run = async (work: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setSaid(undefined)
    setSnag(undefined)
    await work()
    setBusy(false)
  }

  const save = (): Promise<void> =>
    run(async () => {
      const current = settings()
      const who = await whoami(current.token)
      if (!who.ok) {
        setSnag({ at: "github", failure: who.error })
        return
      }
      await connect(current)
      setEdited(undefined)
      await refetch()
      setSaid(t("github.connectedAs", { login: who.value }))
    })

  const take = (): Promise<void> => run(async () => report(await pull()))
  const send = (): Promise<void> => run(async () => report(await push()))

  const report = (result: { ok: true; value: Outcome } | { ok: false; error: Snag }): void => {
    if (!result.ok) {
      setSnag(result.error)
      return
    }
    setSaid(describe(result.value))
  }

  const drop = (): Promise<void> =>
    run(async () => {
      await disconnect()
      setEdited(EMPTY)
      await refetch()
    })

  const ready = (): boolean =>
    settings().owner !== "" && settings().repo !== "" && settings().path !== "" && settings().token !== ""

  return (
    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-medium">{t("github.title")}</h2>
      <p class="text-xs text-muted-foreground">{t("github.lead")}</p>
      <Folded summary={t("github.firstTime")} steps={FIRST} />

      <div class="grid grid-cols-2 gap-2">
        <Field label={t("github.owner")} value={settings().owner} onChange={(owner) => change({ owner })} />
        <Field label={t("github.repo")} value={settings().repo} onChange={(repo) => change({ repo })} />
      </div>
      <Field
        label={t("github.path")}
        value={settings().path}
        placeholder="books/main.journal"
        onChange={(path) => change({ path })}
      />
      <Field
        label={t("github.branch")}
        value={settings().branch}
        placeholder={t("github.branchHint")}
        onChange={(branch) => change({ branch })}
      />
      <Field
        label={t("github.token")}
        value={settings().token}
        secret
        onChange={(token) => change({ token })}
      />
      <p class="text-xs text-muted-foreground">{t("github.tokenHint")}</p>
      <Folded summary={t("github.howTo")} steps={STEPS} link={MAKE_ONE} linkText={t("github.tokenPage")} />

      <div class="flex flex-wrap gap-2">
        <Button size="sm" disabled={!ready() || busy()} onClick={() => void save()}>
          {t("github.connect")}
        </Button>
        <Button variant="outline" size="sm" disabled={!ready() || busy()} onClick={() => void take()}>
          {t("github.pull")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!ready() || busy() || getOrUndefined(journal()) === undefined}
          onClick={() => void send()}
        >
          {t("github.push")}
        </Button>
        <Show when={kept() !== undefined}>
          <Button variant="ghost" size="sm" disabled={busy()} onClick={() => void drop()}>
            {t("github.disconnect")}
          </Button>
        </Show>
      </div>

      <Show when={busy()}>
        <p class="text-xs text-muted-foreground">{t("github.working")}</p>
      </Show>
      <Show when={said()}>{(words) => <p class="text-xs text-muted-foreground">{words()}</p>}</Show>
      <Show when={snag()}>{(cause) => <SnagNote snag={cause()} />}</Show>
    </section>
  )
}

/** GitHub's own page for making one, which is three menus deep from anywhere else. */
const MAKE_ONE = "https://github.com/settings/personal-access-tokens/new"

const STEPS = ["github.step1", "github.step2", "github.step3", "github.step4", "github.step5"] as const

const FIRST = ["github.first1", "github.first2", "github.first3", "github.first4"] as const

/** Only the keys that name a line of instructions, so a whole section cannot be passed. */
type StepKey = (typeof STEPS)[number] | (typeof FIRST)[number]

/**
 * Instructions, folded away.
 *
 * Kept next to what they are about and closed to begin with: someone who has
 * done this before reads past a line, and someone who has not does not have to
 * leave the page to find out what to do.
 */
function Folded(props: {
  summary: string
  steps: readonly StepKey[]
  link?: string
  linkText?: string
}): JSX.Element {
  return (
    <details class="text-xs text-muted-foreground">
      <summary class="cursor-pointer hover:text-foreground">{props.summary}</summary>
      <ol class="mt-1 flex list-decimal flex-col gap-1 pl-5">
        <For each={props.steps}>{(step) => <li>{t(step)}</li>}</For>
      </ol>
      <Show when={props.link}>
        {(href) => (
          <a
            href={href()}
            target="_blank"
            rel="noreferrer"
            class="mt-1 inline-block underline underline-offset-2 hover:text-foreground"
          >
            {props.linkText}
          </a>
        )}
      </Show>
    </details>
  )
}

function Field(props: {
  label: string
  value: string
  placeholder?: string
  secret?: boolean
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <TextField class="flex flex-col gap-1">
      <span class="text-xs font-medium text-muted-foreground">{props.label}</span>
      <TextFieldInput
        type={props.secret === true ? "password" : "text"}
        class="h-8 text-sm"
        autocomplete="off"
        spellcheck={false}
        placeholder={props.placeholder}
        value={props.value}
        onInput={(event) => props.onChange(event.currentTarget.value)}
      />
    </TextField>
  )
}

/** hledger's own troubles are already explained; the rest are said here. */
function SnagNote(props: { snag: Snag }): JSX.Element {
  return (
    <Show when={props.snag.at === "hledger" ? props.snag.trouble : undefined} fallback={<p class="text-xs text-error-foreground">{words(props.snag)}</p>}>
      {(trouble) => <TroubleNote trouble={trouble()} />}
    </Show>
  )
}

const describe = (outcome: Outcome): string => {
  switch (outcome.did) {
    case "pulled":
      return t("github.pulled", { files: outcome.files })
    case "pushed":
      return t("github.pushed", { files: outcome.files })
    case "merged":
      return t("github.merged")
    case "nothing":
      return t("github.nothing")
  }
}

const words = (snag: Snag): string => {
  switch (snag.at) {
    case "not-connected":
      return t("github.notConnected")
    case "no-journal":
      return t("github.noJournal")
    case "diverged":
      return t("github.diverged", { path: snag.path })
    case "hledger":
      return ""
    case "github":
      return fromGitHub(snag.failure)
  }
}

const fromGitHub = (failure: Failure): string => {
  switch (failure.kind) {
    case "offline":
      return t("github.offline")
    case "unauthorised":
      return t("github.unauthorised")
    case "no-such-file":
      return t("github.noSuchFile")
    case "conflict":
      return t("github.conflict")
    case "refused":
      return t("github.refused", { status: failure.status })
  }
}
