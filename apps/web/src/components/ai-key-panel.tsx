import { For, Show, createEffect, createResource, createSignal, type JSX } from "solid-js"

import { soundOut } from "~/ai/check"
import { forgetKey, keepKey, keepListed, keepModel, keepWhich, key, listed, model, which } from "~/ai/kept"
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
 * one's. The key and which model to use are one setting saved by one press,
 * because they are one decision: a key that reaches a model this app cannot
 * talk to is not half-working, it is not working.
 *
 * Checking is its own press, beside it. It is the only honest way to know —
 * listing the models a key can reach says nothing about whether a conversation
 * with one of them is possible, and the difference between those two questions
 * is exactly where Sonnet 4.5 lives. So the check says the real thing to the
 * real model and reports what came back, and saving is left free to save
 * whatever is typed.
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
  const [before] = createResource(talker, (one) => listed(one.id))
  const [typed, setTyped] = createSignal<string | undefined>(undefined)
  const [offered, setOffered] = createSignal<readonly Model[]>([])
  const [picked, setPicked] = createSignal<string | undefined>(undefined)
  const [busy, setBusy] = createSignal(false)
  const [said, setSaid] = createSignal<string | undefined>(undefined)
  const [failure, setFailure] = createSignal<Failure | undefined>(undefined)

  let box: HTMLSelectElement | undefined

  const typing = (): string => typed() ?? saved() ?? ""

  /**
   * Something to choose from before anything has been asked.
   *
   * Until a check has listed them there is exactly one model worth naming — the
   * one already in use, or this provider's default — and offering it is better
   * than an empty box that looks broken.
   */
  const choices = (): readonly Model[] => {
    const listed = offered().length > 0 ? offered() : (before() ?? [])
    const kept = named()
    const shown =
      listed.length > 0
        ? listed
        : [kept ?? { id: talker().defaultModel, label: talker().defaultModel }]

    // Whatever is chosen stays in the list even when a fresh listing has
    // dropped it. A box cannot show what it does not hold, so without this the
    // one thing that must not happen silently — the choice changing — is what
    // the browser does on its own the moment the options are replaced.
    const want = settledOn()
    return want === undefined || shown.some((one) => one.id === want)
      ? shown
      : [...shown, kept?.id === want ? kept : { id: want, label: want }]
  }

  /**
   * What has actually been chosen — as opposed to what the box is showing for
   * want of a choice.
   *
   * The difference is the whole of it. A default is what to put on the screen
   * before the answer arrives; acted on, it is a choice nobody made, quietly
   * replacing the one it was standing in for.
   */
  const settledOn = (): string | undefined => picked() ?? named()?.id

  const picking = (): string => settledOn() ?? talker().defaultModel

  /**
   * The chosen one, said to the box after its options exist.
   *
   * What fills the picker and what selects within it are read from the database
   * separately and do not arrive together. Bound as a `value` prop, the choice
   * is applied whenever it changes — including while the list is still the one
   * option it started with, where the browser has nothing to select and falls
   * back to the first. Depending on the list as well as the choice, and writing
   * it after the render that added them, is what makes the two agree.
   */
  createEffect(() => {
    const want = picking()
    const listed = choices()
    if (box !== undefined && listed.some((one) => one.id === want)) box.value = want
  })

  /**
   * Whatever happens, the panel comes back.
   *
   * Without the `finally` a throw anywhere in here leaves every box disabled
   * with nothing said, which reads exactly like a request that never returned
   * — and is far harder to tell apart from one.
   */
  const run = async (work: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setSaid(undefined)
    setFailure(undefined)
    try {
      await work()
    } catch (cause) {
      setFailure({ kind: "unreadable", detail: String(cause) })
    } finally {
      setBusy(false)
    }
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
    setPicked(undefined)
    setSaid(undefined)
    setFailure(undefined)
    forgetChat()
    void keepWhich(one.id)
  }

  /**
   * All of it at once, because it is one setting. Nothing is sent.
   *
   * Which provider is written here too, not only where it is picked. Picking
   * cannot wait for a write — it is a click handler, and the panel has to move
   * under the finger — so it starts one and lets go; this is where that is made
   * certain. Without it a key saved quickly enough belongs to whichever
   * provider the last committed write happened to name.
   */
  const save = (): Promise<void> =>
    run(async () => {
      const one = choices().find((each) => each.id === picking())
      await keepWhich(talker().id)
      await keepKey(talker().id, typing())
      if (one !== undefined) await keepModel(talker().id, one)
      setTyped(undefined)
      setPicked(undefined)
      await refetch()
      await refetchModel()
      setSaid(t("ai.saved", { provider: talker().label, model: one?.label ?? picking() }))
    })

  /**
   * The two questions, in order: what can this key reach, and can the chosen one
   * of those actually be talked to.
   *
   * The list is refreshed on the way through, so the picker is filled by the
   * same press that proves the key — and a model that has gone from the account
   * since it was chosen shows up here rather than in the middle of a question.
   */
  const check = (): Promise<void> =>
    run(async () => {
      setSaid(t("ai.listing"))
      const reachable = await talker().models(typing())
      if (!reachable.ok) {
        setFailure(reachable.error)
        return
      }

      setOffered(reachable.value)
      await keepListed(talker().id, reachable.value)
      if (reachable.value.length === 0) {
        // A key that works and reaches nothing this app can drive is not an
        // error — it is a fact about the account, and saying "0 available"
        // would leave somebody hunting a fault in a key they typed correctly.
        setSaid(t("ai.noneUsable"))
        return
      }

      /**
       * Checking asks about the model that is chosen. It does not choose.
       *
       * Finding out that some other model is reachable is no reason to move to
       * it, and a chosen one that has gone from the account is worth saying
       * rather than papering over. The one case where this does choose is the
       * first: nothing has been chosen yet, and the newest is where to start.
       */
      const want = settledOn()
      const one =
        want === undefined ? reachable.value[0] : reachable.value.find((each) => each.id === want)

      if (one === undefined) {
        setSaid(t("ai.notThere", { model: named()?.label ?? want ?? "" }))
        return
      }
      setPicked(one.id)
      setSaid(t("ai.sounding", { model: one.label }))

      const sounded = await soundOut(talker(), typing(), one)
      if (!sounded.ok) {
        setFailure(sounded.error)
        return
      }
      setSaid(
        t("ai.answered", {
          model: one.label,
          sent: sounded.value.spent.sent,
          back: sounded.value.spent.back,
        }),
      )
    })

  const drop = (): Promise<void> =>
    run(async () => {
      await forgetKey(talker().id)
      forgetChat()
      setTyped("")
      setOffered([])
      setPicked(undefined)
      await refetch()
    })

  return (
    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-medium">{t("ai.title")}</h2>
      <p class="text-xs text-muted-foreground">{t("ai.lead", { host: talker().host })}</p>

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

      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted-foreground">{t("ai.model")}</span>
        <select
          ref={box}
          class="h-8 rounded-md border border-border bg-transparent px-2 text-sm"
          disabled={busy()}
          onChange={(event) => setPicked(event.currentTarget.value)}
        >
          <For each={choices()}>{(one) => <option value={one.id}>{one.label}</option>}</For>
        </select>
      </label>
      <p class="text-xs text-muted-foreground">{t("ai.modelHint")}</p>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={typing() === "" || busy()}
          onClick={() => void check()}
        >
          {t("ai.check")}
        </Button>
        <Button size="sm" disabled={typing() === "" || busy()} onClick={() => void save()}>
          {t("ai.save")}
        </Button>
        <Show when={saved() !== undefined}>
          <Button size="sm" variant="ghost" disabled={busy()} onClick={() => void drop()}>
            {t("ai.disconnect")}
          </Button>
        </Show>
      </div>

      <Show when={said()}>{(word) => <p class="text-xs text-muted-foreground">{word()}</p>}</Show>
      <Show when={failure()}>
        {(went) => <p class="text-xs text-destructive">{wording(went())}</p>}
      </Show>
    </section>
  )
}

/** Every case said in the reader's language, since none of them is a model's own words. */
export const wording = (failure: Failure): string => {
  switch (failure.kind) {
    case "offline":
      return t("ai.offline")
    case "timed-out":
      return t("ai.timedOut", { seconds: Math.round(failure.after / 1000) })
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
