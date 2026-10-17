---
title: Google Sheets: QUERY and array formulas; Excel: FILTER, UNIQUE and spill
source: Google Visualization API Query Language, QUERY function help, and Microsoft Support (#SPILL! error)
source_url: https://developers.google.com/chart/interactive/docs/querylanguage
source_date: 2026-10-02
valid_until: 2027-04-30
tags: [query, sheets, filtro, unico, despejo, matrizes]
---

## QUERY: syntax and the rules that catch people most

`QUERY(data, query, [headers])`. The query uses the Google Visualization API Query Language, as text in quotes (or in a cell). The order of the clauses is fixed: `select`, `where`, `group by`, `pivot`, `order by`, `limit`, `offset`, `label`, `format`, `options`. All of them are optional.

Example: `=QUERY(A1:D,"select B, sum(D) where C = 'Paid' group by B order by sum(D) desc",1)`. Columns are identified by the letters of the range; when the data comes from an array (`{...}`) or from another function such as IMPORTRANGE, the columns are called `Col1`, `Col2`. Text goes in single quotes inside the query, and numbers use a point as the decimal even in a spreadsheet in Portuguese. (In a spreadsheet configured in Brazilian Portuguese, the arguments of QUERY itself are separated by semicolons: `=QUERY(A1:D;"...";1)`.)

## QUERY: dates, pivot and types

Aggregation functions: `avg`, `count`, `max`, `min`, `sum`, applied only to columns, not to expressions (`max(year(date))` is invalid). Scalar date functions: `year`, `month`, `day`, `quarter`, `dayOfWeek`, among others. Careful: `month()` returns the month starting at zero (January is 0), so add 1 when you want the month number. Date literal: `date '2026-01-31'`. Nulls: `is null` and `is not null`. Text: `contains`, `starts with`, `ends with`, `matches` (regular expression) and `like`.

With `pivot`, every `select` column must be in the `group by` or inside an aggregation, and the pivot column cannot appear in the `select`, the `group by` or the `order by`. Example: `=QUERY(A1:C,"select B, sum(C) where A is not null group by B pivot month(A)+1",1)`.

Mixed types: according to Google's help, each column accepts boolean, number (including date and time) or text; when types are mixed, the majority type wins and the minority ones become nulls. A date column with some dates stored as text loses those rows without warning.

## FILTER and UNIQUE in Excel

`FILTER(array, include, [if_empty])`, `UNIQUE(array, [by_col], [exactly_once])` and `SORT` are in Excel 2021, 2024, Microsoft 365 and the web, not in 2019 or 2016 (in Brazilian Portuguese: `FILTRO`, `ÚNICO`, `CLASSIFICAR`). They return an array that spreads across the neighboring cells (spill). Example: `=FILTER(A2:D500,C2:C500="Paid","nothing found")`. To use the whole result in another formula, reference the first cell with `#`: `=SUM(F2#)`.

In Google Sheets, `FILTER`, `UNIQUE` and `SORT` do the same; use `ARRAYFORMULA` when an ordinary function has to be applied to a whole column.

## The #SPILL! error

The error (`#DESPEJAR!` in Brazilian Portuguese) appears when the formula returns several values and Excel cannot write them out. Causes listed by Microsoft: the spill range has occupied cells (use "Select Obstructing Cells"); an undetermined size, common with volatile functions such as RAND; a spill that goes past the edge of the worksheet (limit the references instead of using whole columns); a formula inside an Excel Table; lack of memory; and merged cells in the spill area.
