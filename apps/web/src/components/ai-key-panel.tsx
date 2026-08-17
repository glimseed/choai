import { For, Show, createEffect, createResource, createSignal, type JSX } from "solid-js"

import { soundOut } from "~/ai/check"
import { forgetKey, keepKey, keepListed, keepModel, keepWhich, key, listed, model, which } from "~/ai/kept"
import { forgetChat } from "~/ai/store"
import type { Failure, Model, Talker } from "~/ai/talker"
import { EVERYONE, talkerFor } from "~/ai/talkers"
import { Button } from "~/components/ui/button"
import { Suggesting } from "~/lib/ui/suggesting"
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
  const [before, { mutate: nowListed }] = createResource(talker, (one) => listed(one.id))

  /**
   * Filling the picker, which is not the same act as proving the key.
   *
   * Asking which models a key reaches is free and instant; saying something to
   * one of them is neither. Only the second is worth a button of its own, so
   * the first happens wherever a picker is about to be looked at — on saving,
   * and on arriving with a key already kept and no list from last time. A
   * picker with one thing in it is not a picker, and there is nothing on the
   * screen to say that the one thing is a placeholder.
   *
   * It says when it cannot. A picker that stayed at its one placeholder looks
   * exactly the same whether the key was refused, the network was out, or every
   * model the account has is one this app cannot drive — and none of those is
   * something to work out from an unchanged screen.
   */
  const fill = async (key: string): Promise<readonly Model[]> => {
    const reachable = await talker().models(key)
    if (!reachable.ok) {
      setFailure(reachable.error)
      return []
    }
    if (reachable.value.length === 0) {
      setSaid(t("ai.noneUsable"))
      return []
    }
    setOffered(reachable.value)
    nowListed(reachable.value)
    await keepListed(talker().id, reachable.value)
    return reachable.value
  }
  const [typed, setTyped] = createSignal<string | undefined>(undefined)
  const [offered, setOffered] = createSignal<readonly Model[]>([])
  const [picked, setPicked] = createSignal<string | undefined>(undefined)
  const [busy, setBusy] = createSignal(false)
  const [said, setSaid] = createSignal<string | undefined>(undefined)
  const [failure, setFailure] = createSignal<Failure | undefined>(undefined)


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

    return shown
  }

  /**
   * What has actually been chosen — as opposed to what the box is showing for
   * want of a choice.
   *
   * The difference is the whole of it. A default is what to put on the screen
   * before the answer arrives; acted on, it is a choice nobody made, quietly
   * replacing the one it was standing in for.
   */
  const settledOn = (): string | undefined => {
    const typed = picked()
    if (typed !== undefined) return typed.trim() === "" ? undefined : typed
    return named()?.id
  }

  /**
   * What is in the box: what was chosen, or something that exists to start
   * from. The provider's default is the last resort rather than the first,
   * because an account that does not have it would open on a name that cannot
   * be used and no sign of which ones can.
   */
  const picking = (): string => settledOn() ?? choices()[0]?.id ?? talker().defaultModel


  /**
   * Whatever happens, the panel comes back.
   *
   * Without the `finally` a throw anywhere in here leaves every box disabled
   * with nothing said, which reads exactly like a request that never returned
   * — and is far harder to tell apart from one.
   */
  /**
   * Arriving with a key kept and nothing to choose from.
   *
   * Which is where anybody stands the first time after saving, and where every
   * key saved before this panel kept a list stands for good. Listing is free,
   * so it is done rather than waited to be asked for — and once, because what
   * it finds is kept.
   */
  createEffect(() => {
    const key = saved()
    const kept = before()
    if (key === undefined || key === "" || before.loading) return
    if (kept !== undefined && kept.length > 0) return
    if (offered().length > 0 || busy()) return
    void fill(key)
  })

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
      // Listed first, so what is kept about the chosen model is what the
      // provider says of it — its ceiling, and what it will take — rather than
      // a bare id standing in for one.
      const fresh = await fill(typing())
      const among = fresh.length > 0 ? fresh : choices()
      const one = among.find((each) => each.id === picking())
      await keepWhich(talker().id)
      await keepKey(talker().id, typing())
      if (one !== undefined) await keepModel(talker().id, one)
      setTyped(undefined)
      setPicked(undefined)
      await refetch()
      await refetchModel()
      // Saving worked whatever the listing did, but a listing that did not is
      // the more useful thing to be told, so it is left standing where it spoke.
      if (failure() === undefined && said() === undefined) {
        setSaid(t("ai.saved", { provider: talker().label, model: one?.label ?? picking() }))
      }
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
      nowListed(reachable.value)
      await keepListed(talker().id, reachable.value)
      if (reachable.value.length === 0) {
        // A key that works and reaches nothing this app can drive is not an
        // error — it is a fact about the account, and saying "0 available"
        // would leave somebody hunting a fault in a key they typed correctly.
        setSaid(t("ai.noneUsable"))
        return
      }

      /**
       * Whatever is in the box is what is asked about, listed or not. A name
       * typed in and not among the suggestions is a name the reader knows and
       * this app does not, and the way to find out which is to try it.
       */
      const want = picking()
      const one = reachable.value.find((each) => each.id === want) ?? { id: want, label: want }
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

      <label class="flex flex-col gap-1" for="ai-model">
        <span class="text-xs text-muted-foreground">{t("ai.model")}</span>
        <Suggesting
          id="ai-model"
          value={picking()}
          onInput={setPicked}
          options={choices().map((one) => ({ value: one.id, label: one.label }))}
          disabled={busy()}
          placeholder={talker().defaultModel}
        />
      </label>
      <p class="text-xs text-muted-foreground">
        {t("ai.modelHint")}{" "}
        <a class="underline" href={talker().modelsFrom} target="_blank" rel="noreferrer">
          {t("ai.everyModel", { provider: talker().label })}
        </a>
      </p>

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
