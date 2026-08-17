import { For, Show, createResource, createSignal, type JSX } from "solid-js"

import { forgetKey, keepKey, keepModel, keepWhich, key, model, which } from "~/ai/kept"
import { forgetChat } from "~/ai/store"
import type { Failure, Model, Talker } from "~/ai/talker"
import { EVERYONE, talkerFor } from "~/ai/talkers"
import { Button } from "~/components/ui/button"
import { TextField, TextFieldInput } from "~/components/ui/text-field"
import { t } from "~/i18n"

/**
 * Who to ask, and the key for asking them.
 *
 * One key per provider, kept apart, so trying another does not cost the first
 * one's. Each is checked before it is kept, by asking which models it can reach:
 * the cheapest question there is, and its answer is the list to choose from.
 *
 * Where what is typed here goes is said on the page — and so is what the other
 * end does with it, because "free" and "read by people" are the same sentence at
 * one of them, and these are somebody's books.
 */
export function AiKeyPanel(): JSX.Element {
  const [chosen, { mutate: nowUsing }] = createResource(which)
  const talker = (): Talker => talkerFor(chosen())

  const [saved, { refetch }] = createResource(talker, (one) => key(one.id))
  const [named, { refetch: refetchModel }] = createResource(talker, (one) => model(one.id))
  const [typed, setTyped] = createSignal<string | undefined>(undefined)
  const [offered, setOffered] = createSignal<readonly Model[]>([])
  const [busy, setBusy] = createSignal(false)
  const [said, setSaid] = createSignal<string | undefined>(undefined)
  const [failure, setFailure] = createSignal<Failure | undefined>(undefined)

  const typing = (): string => typed() ?? saved() ?? ""

  const run = async (work: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setSaid(undefined)
    setFailure(undefined)
    await work()
    setBusy(false)
  }

  /**
   * Changing provider changes which key is in the box and whose conversation it
   * was.
   *
   * The choice is moved here rather than re-read, because re-reading would put
   * the panel back into loading — with every box in it disabled — for as long as
   * the database took, to arrive at the value we already have.
   */
  const pick = (id: string): void => {
    const one = talkerFor(id)
    if (one.id === talker().id) return
    nowUsing(one.id)
    setTyped(undefined)
    setOffered([])
    setSaid(undefined)
    setFailure(undefined)
    forgetChat()
    void keepWhich(one.id)
  }

  const save = (): Promise<void> =>
    run(async () => {
      const reachable = await talker().models(typing())
      if (!reachable.ok) {
        setFailure(reachable.error)
        return
      }
      await keepKey(talker().id, typing())
      setOffered(reachable.value)
      setTyped(undefined)
      await refetch()
      // A key that works and reaches nothing this app can drive is not an error
      // — it is a fact about the account, and saying "0 available" would leave
      // somebody looking for a fault in the key they just typed correctly.
      setSaid(
        reachable.value.length === 0
          ? t("ai.noneUsable")
          : t("ai.ready", { count: reachable.value.length }),
      )
    })

  const drop = (): Promise<void> =>
    run(async () => {
      await forgetKey(talker().id)
      forgetChat()
      setTyped("")
      setOffered([])
      await refetch()
    })

  const choose = (id: string): Promise<void> =>
    run(async () => {
      await keepModel(talker().id, id)
      await refetchModel()
    })

  return (
    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-medium">{t("ai.title")}</h2>
      <p class="text-xs text-muted-foreground">{t("ai.lead", { host: hostOf(talker()) })}</p>

      <span class="text-xs text-muted-foreground">{t("ai.provider")}</span>
      <div class="flex flex-wrap gap-2">
        <For each={EVERYONE}>
          {(one) => (
            <Button
              variant={talker().id === one.id ? "default" : "outline"}
              size="sm"
              disabled={busy()}
              onClick={() => pick(one.id)}
            >
              {one.label}
            </Button>
          )}
        </For>
      </div>

      <Show when={talker().id === "gemini"}>
        <p class="text-xs text-destructive">{t("ai.freeIsRead")}</p>
      </Show>

      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted-foreground">{t("ai.key")}</span>
        <TextField>
          <TextFieldInput
            type="password"
            class="h-8 text-sm"
            autocomplete="off"
            spellcheck={false}
            value={typing()}
            onInput={(event) => setTyped(event.currentTarget.value)}
          />
        </TextField>
      </label>
      <p class="text-xs text-muted-foreground">
        {t("ai.keyHint", { provider: talker().label })}{" "}
        <a class="underline" href={talker().keysFrom} target="_blank" rel="noreferrer">
          {t("ai.getKey")}
        </a>
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={typing() === "" || busy()} onClick={() => void save()}>
          {t("ai.connect")}
        </Button>
        <Show when={saved() !== undefined}>
          <Button size="sm" variant="ghost" disabled={busy()} onClick={() => void drop()}>
            {t("ai.disconnect")}
          </Button>
        </Show>
      </div>

      <Show when={offered().length > 0}>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">{t("ai.model")}</span>
          <select
            class="h-8 rounded-md border border-border bg-transparent px-2 text-sm"
            value={named() ?? talker().defaultModel}
            onChange={(event) => void choose(event.currentTarget.value)}
          >
            <For each={offered()}>{(one) => <option value={one.id}>{one.label}</option>}</For>
          </select>
        </label>
        <p class="text-xs text-muted-foreground">{t("ai.modelHint")}</p>
      </Show>

      <Show when={said()}>{(word) => <p class="text-xs text-muted-foreground">{word()}</p>}</Show>
      <Show when={failure()}>
        {(went) => <p class="text-xs text-destructive">{wording(went())}</p>}
      </Show>
    </section>
  )
}

const hostOf = (talker: Talker): string =>
  talker.id === "gemini" ? "generativelanguage.googleapis.com" : "api.anthropic.com"

/** Every case said in the reader's language, since none of them is a model's own words. */
export const wording = (failure: Failure): string => {
  switch (failure.kind) {
    case "offline":
      return t("ai.offline")
    case "unauthorised":
      return t("ai.unauthorised")
    case "rate-limited":
      return t("ai.rateLimited")
    case "overloaded":
      return t("ai.overloaded")
    case "refused":
      return t("ai.refused", { status: failure.status })
    case "unreadable":
      return t("ai.unreadable")
  }
}
