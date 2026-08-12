/**
 * The demo journal in English.
 *
 * Covers all five account types so that the balance sheet and the income
 * statement both have something to report.
 *
 * The `D` directive gives the amounts their styling — symbol in front, thousands
 * grouped — and stands as the commodity for any amount written without one,
 * which is what a new journal starts with too.
 */
export const demoEn = `; a demo journal

D $1,000.00

account assets:bank:checking    ; type:A
account assets:cash             ; type:A
account liabilities:card        ; type:L
account equity:opening          ; type:E
account income:salary           ; type:R
account expenses:rent           ; type:X
account expenses:food           ; type:X
account expenses:transport      ; type:X

2026-01-01 opening balance
    assets:bank:checking      $4200.00
    assets:cash                $180.00
    liabilities:card          $-320.00
    equity:opening

2026-01-05 landlord
    expenses:rent             $1200.00
    assets:bank:checking

2026-01-07 supermarket
    expenses:food               $86.40
    liabilities:card

2026-01-10 metro card
    expenses:transport          $40.00
    assets:cash

2026-01-25 employer
    assets:bank:checking      $3100.00
    income:salary

2026-02-01 landlord
    expenses:rent             $1200.00
    assets:bank:checking

2026-02-03 supermarket
    expenses:food              $102.75
    liabilities:card

2026-02-14 restaurant
    expenses:food               $58.00
    assets:bank:checking

2026-02-25 employer
    assets:bank:checking      $3100.00
    income:salary
`
