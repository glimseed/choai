/*
 * choai — hledger journals in the browser
 * Copyright (C) 2026  choai contributors
 *
 * Free software under the GNU General Public License, version 3 or later, and
 * distributed with no warranty of any kind. The full notice is in LICENSE at
 * the root of this repository, and at <https://www.gnu.org/licenses/>.
 */

/* @refresh reload */
import { render } from "solid-js/web"
import { Route, Router } from "@solidjs/router"

import "./app.css"
/* Puts window.choai in place before anything is drawn. */
import "~/api/install"
import { Layout } from "~/app"
import Journal from "~/routes/journal"
import BalanceSheet from "~/routes/balance-sheet"
import IncomeStatement from "~/routes/income-statement"
import Accounts from "~/routes/accounts"
import Settings from "~/routes/settings"
import Licenses from "~/routes/licenses"
import Source from "~/routes/source"
import Add from "~/routes/add"

render(
  () => (
    <Router root={Layout}>
      <Route path="/" component={Journal} />
      <Route path="/balance-sheet" component={BalanceSheet} />
      <Route path="/income-statement" component={IncomeStatement} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/settings" component={Settings} />
      <Route path="/licenses" component={Licenses} />
      <Route path="/source" component={Source} />
      <Route path="/add" component={Add} />
    </Router>
  ),
  document.getElementById("root")!,
)
