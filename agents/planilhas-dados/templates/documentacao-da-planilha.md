# Spreadsheet read-me

Paste this into a sheet called "Read me" (or into comments on the key cells). Whoever opens the file six months from now needs to understand it without asking.

- **What it is for:** <one sentence>
- **Program and version it was built in:** <Excel 365 | Excel 2021 | Google Sheets> / **Formula language:** <English with `,` | Portuguese with `;`>
- **Updated on:** <date> by <name>

## Sheets

| Sheet | Contents | Who changes it |
|---|---|---|
| <Data> | <one row per record; columns: ...> | <who enters the data> |
| <Summary> | <formulas and PivotTables; do not type here> | nobody (read only) |

## How to update

1. <Paste the new data at the end of the Data sheet, with no blank rows in the middle.>
2. <Refresh the PivotTables (Data > Refresh All) if there are any.>
3. <Check the control total: it must equal <reference value>.>

## Main formulas

| Cell or column | What it does | Note |
|---|---|---|
| <Summary!B2> | <adds up the sales of the salesperson on the row, in the period set in cells B1 and C1> | <uses the Sales Table; grows on its own> |

## Rules and precautions

- <Code columns (postal code, product) are text: do not convert them to numbers.>
- <Dates in the dd/mm/yyyy format; never type them as text.>
- <Tax rates, commission values and deadlines used in the formulas: check them at the official source whenever a rule changes. Source: <...>.>
- <Personal data: <exists | does not exist> in this spreadsheet; sharing: <who has access>.>
