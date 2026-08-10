import type { ParentProps } from "solid-js"
import { For } from "solid-js"
import { A, useLocation } from "@solidjs/router"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"
import { Separator } from "~/components/ui/separator"

// The daily journal comes first because that is what the app is opened for;
// the statements are things you go and look at, not things you live in.
const NAV = [
  { href: "/", label: "Journal" },
  { href: "/balance-sheet", label: "Balance sheet" },
  { href: "/income-statement", label: "Income statement" },
  { href: "/accounts", label: "Accounts" },
  { href: "/settings", label: "Settings" },
] as const

export function Layout(props: ParentProps) {
  const location = useLocation()

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader class="px-4 py-3">
          <span class="font-semibold tracking-tight">ownhledger</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Ledger</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <For each={NAV}>
                  {(item) => (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        as={A}
                        href={item.href}
                        isActive={location.pathname === item.href}
                      >
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </For>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" class="mr-2 h-4" />
          <h1 class="text-sm font-medium">
            {NAV.find((item) => item.href === location.pathname)?.label ?? "ownhledger"}
          </h1>
        </header>
        <main class="flex-1 overflow-auto p-4">{props.children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
