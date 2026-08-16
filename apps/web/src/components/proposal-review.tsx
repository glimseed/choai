import { For, Show, createEffect, createSignal, on, type JSX } from "solid-js"

import { draftToJournal } from "~/compose/draft"
import { TroubleNote } from "~/components/trouble-note"
import { Button } from "~/components/ui/button"
import {
  SURE,
  apply,
  drop,
  sureIn,
  underReview,
  type Proposal,
  type Refusal,
} from "~/journal/proposals"
import { t } from "~/i18n"

/**
 * Entries written but not yet kept, and the decision about them.
 *
 * The ones written with confidence are ticked and the doubtful ones are not, so
 * a hundred entries with three worth arguing about is one glance and one press,
 * with the three still there afterwards. Nothing is kept until the press: what
 * is on this screen is the text, exactly as it would be written.
 */
export function ProposalReview(): JSX.Element {
  return (
    <Show when={underReview()}>{(proposal) => <One proposal={proposal()} />}</Show>
  )
}

function One(props: { proposal: Proposal }): JSX.Element {
  const [ticked, setTicked] = createSignal<readonly number[]>([])
  const [busy, setBusy] = createSignal(false)
  const [refused, setRefused] = createSignal<Refusal | undefined>(undefined)

  /** A rebased proposal is a different one; what was ticked on the last is not this. */
  createEffect(
    on(
      () => props.proposal.id,
      () => {
        setTicked(sureIn(props.proposal))
        setRefused(undefined)
      },
    ),
  )

  const sure = (): number => sureIn(props.proposal).length
  const unsure = (): number => props.proposal.items.length - sure()
  const reads = (): boolean => props.proposal.reads.ok

  const toggle = (at: number): void => {
    setTicked((was) => (was.includes(at) ? was.filter((one) => one !== at) : [...was, at]))
  }

  const keep = async (): Promise<void> => {
    const only = ticked()
    if (only.length === 0) return
    setBusy(true)
    setRefused(undefined)
    const all = only.length === props.proposal.items.length
    const done = await apply(props.proposal.id, all ? undefined : only)
    setBusy(false)
    if (!done.ok) setRefused(done.error)
  }

  return (
    <div class="flex h-full flex-col">
      <div class="flex-1 overflow-y-auto p-3">
        <div class="flex flex-col gap-3">
          <p class="text-sm">
            {t("propose.counted", { sure: sure(), unsure: unsure() })}
          </p>

          <Show when={!props.proposal.reads.ok && props.proposal.reads}>
            {(read) => (
              <div class="flex flex-col gap-1">
                <p class="text-xs text-destructive">{t("propose.doesNotRead")}</p>
                <TroubleNote trouble={read().error} />
              </div>
            )}
          </Show>

          <Show when={refused()}>
            {(why) => <p class="text-xs text-destructive">{wording(why())}</p>}
          </Show>

          <For each={props.proposal.items}>
            {(item, at) => (
              <label class="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2">
                <input
                  type="checkbox"
                  class="mt-1"
                  checked={ticked().includes(at())}
                  onChange={() => toggle(at())}
                />
                <span class="flex min-w-0 flex-1 flex-col gap-1">
                  <pre class="overflow-x-auto whitespace-pre text-xs">{draftToJournal(item.draft)}</pre>
                  <Show when={item.confidence < SURE}>
                    <span class="text-xs text-muted-foreground">
                      {t("propose.worthALook")}
                      <Show when={item.why}>{(why) => <> — {why()}</>}</Show>
                    </span>
                  </Show>
                </span>
              </label>
            )}
          </For>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 border-t p-3">
        <Button
          size="sm"
          disabled={busy() || !reads() || ticked().length === 0}
          onClick={() => void keep()}
        >
          {t("propose.keep", { count: ticked().length })}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy()}
          onClick={() => setTicked(sureIn(props.proposal))}
        >
          {t("propose.onlySure")}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy()} onClick={() => drop(props.proposal.id)}>
          {t("propose.discard")}
        </Button>
      </div>
    </div>
  )
}

const wording = (refusal: Refusal): string => {
  switch (refusal.at) {
    case "no-journal":
      return t("trouble.noJournal")
    case "nothing-proposed":
    case "no-such-proposal":
      return t("propose.gone")
    case "stale-proposal":
      return t("propose.moved")
    case "hledger":
      return t("propose.doesNotRead")
  }
}
