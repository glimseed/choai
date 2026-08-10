// Vendored from stefan-karger/solid-ui (main): apps/docs/src/registry/ui/skeleton.tsx
// Edited freely -- this is a copy, not a dependency. Re-fetch with scripts/vendor-ui.mjs.

import type { ValidComponent } from "solid-js"
import { splitProps } from "solid-js"

import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import * as SkeletonPrimitive from "@kobalte/core/skeleton"

import { cn } from "~/lib/utils"

type SkeletonRootProps<T extends ValidComponent = "div"> =
  SkeletonPrimitive.SkeletonRootProps<T> & { class?: string | undefined }

const Skeleton = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SkeletonRootProps<T>>
) => {
  const [local, others] = splitProps(props as SkeletonRootProps, ["class"])
  return (
    <SkeletonPrimitive.Root
      class={cn("bg-primary/10 data-[animate='true']:animate-pulse", local.class)}
      {...others}
    />
  )
}

export { Skeleton }
