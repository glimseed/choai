import { anthropic } from "./anthropic"
import { gemini } from "./gemini"
import { openai } from "./openai"
import type { Talker, Which } from "./talker"

/**
 * Everyone this app can talk to.
 *
 * One table again, for the same reason the capabilities are one: the picker in
 * settings, the key kept per provider, and whatever the conversation is using
 * are all read off this, so a provider cannot be half-added.
 */
export const TALKERS: Readonly<Record<Which, Talker>> = {
  anthropic,
  gemini,
  openai,
}

export const EVERYONE: readonly Talker[] = [anthropic, gemini, openai]

/** Whoever is meant, or Claude, which is what this app is named after. */
export const talkerFor = (which: string | undefined): Talker =>
  which !== undefined && Object.hasOwn(TALKERS, which) ? TALKERS[which as Which] : anthropic
