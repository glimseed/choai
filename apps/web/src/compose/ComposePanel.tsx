import { For, Show, type JSX } from "solid-js"

import { journal, entryText } from "~/journal/store"
import { getOrUndefined } from "~/lib/monad"
import { Button } from "~/components/ui/button"
import { TextField, TextFieldInput } from "~/components/ui/text-field"
import { TroubleNote } from "~/components/trouble-note"
import { t } from "~/i18n"
import { draftToJournal } from "./draft"
import {
  addPosting,
  draft,
  editDraft,
  editPosting,
  save,
  saving,
  savingTrouble,
  suggestFromDescription,
  writable,
} from "./store"

/**
 * Writing an entry, beside the journal it goes into.
 *
 * The text that will be written is shown underneath the boxes, because that text
 * is what the file will contain and what version control will show. It is also
 * the quickest way to learn the format for anyone who has not written one by
 * hand yet.
 */
export function ComposePanel(): JSX.Element {
  const accounts = (): readonly string[] => getOrUndefined(journal())?.summary.accounts ?? []

  /**
   * An example in the currency the books are already kept in.
   *
   * A bare number is a commodity of its own as far as hledger is concerned, so
   * typing one into yen books quietly starts a second currency. Showing the
   * symbol here is a nudge; what gets written is still exactly what was typed.
   */
  const amountHint = (): string => {
    const symbol = getOrUndefined(journal())?.summary.commodities[0]
    return symbol === undefined ? t("compose.amount") : `${symbol}1200`
  }

  const write = async (): Promise<void> => {
    const text = entryText()
    if (text !== undefined) await save(text)
  }

  return (
    <div class="flex flex-col gap-3 p-3">
      <Field label={t("compose.date")}>
        <TextFieldInput
          type="date"
          class="h-8"
          value={draft().date}
          onInput={(event) => editDraft({ date: event.currentTarget.value })}
        />
      </Field>

      <Field label={t("compose.description")}>
        <TextFieldInput
          type="text"
          class="h-8"
          placeholder={t("compose.descriptionHint")}
          value={draft().description}
          onInput={(event) => editDraft({ description: event.currentTarget.value })}
          onBlur={(event) => void suggestFromDescription(event.currentTarget.value)}
        />
      </Field>

      <datalist id="known-accounts">
        <For each={accounts()}>{(account) => <option value={account} />}</For>
      </datalist>

      <div class="flex flex-col gap-1">
        <span class="text-xs font-medium text-muted-foreground">{t("compose.postings")}</span>
        <For each={draft().postings}>
          {(posting, index) => (
            <div class="flex gap-1">
              <TextField class="flex-1">
                <TextFieldInput
                  type="text"
                  class="h-8"
                  list="known-accounts"
                  placeholder={t("compose.account")}
                  value={posting.account}
                  onInput={(event) => editPosting(index(), { account: event.currentTarget.value })}
                />
              </TextField>
              <TextField class="w-24">
                <TextFieldInput
                  type="text"
                  class="h-8 text-right font-mono"
                  placeholder={amountHint()}
                  value={posting.amount}
                  onInput={(event) => editPosting(index(), { amount: event.currentTarget.value })}
                />
              </TextField>
            </div>
          )}
        </For>
        <Button variant="ghost" size="sm" class="self-start px-1" onClick={addPosting}>
          {t("compose.addPosting")}
        </Button>
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-xs font-medium text-muted-foreground">{t("compose.willBeWritten")}</span>
        <pre class="overflow-x-auto rounded-md border bg-muted/40 p-2 font-mono text-xs">
          {draftToJournal(draft())}
        </pre>
        <Show when={hasBlankAmount()}>
          <span class="text-xs text-muted-foreground">{t("compose.hledgerFillsTheRest")}</span>
        </Show>
      </div>

      <Show when={getOrUndefined(savingTrouble())}>
        {(trouble) => <TroubleNote trouble={trouble()} />}
      </Show>

      <Button disabled={!writable() || saving()} onClick={() => void write()}>
        {t("compose.add")}
      </Button>
    </div>
  )
}

/** A posting with no figure is what tells hledger to work the last one out. */
const hasBlankAmount = (): boolean =>
  draft().postings.some(
    (posting) => posting.account.trim() !== "" && posting.amount.trim() === "",
  )

function Field(props: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <TextField class="flex flex-col gap-1">
      <span class="text-xs font-medium text-muted-foreground">{props.label}</span>
      {props.children}
    </TextField>
  )
}
