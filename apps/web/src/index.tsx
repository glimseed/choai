/* @refresh reload */
import { render } from "solid-js/web"
import { Route, Router } from "@solidjs/router"

import "./app.css"
import { Layout } from "~/app"
import Journal from "~/routes/journal"
import BalanceSheet from "~/routes/balance-sheet"
import IncomeStatement from "~/routes/income-statement"
import Accounts from "~/routes/accounts"
import Settings from "~/routes/settings"

render(
  () => (
    <Router root={Layout}>
      <Route path="/" component={Journal} />
      <Route path="/balance-sheet" component={BalanceSheet} />
      <Route path="/income-statement" component={IncomeStatement} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/settings" component={Settings} />
    </Router>
  ),
  document.getElementById("root")!,
)
