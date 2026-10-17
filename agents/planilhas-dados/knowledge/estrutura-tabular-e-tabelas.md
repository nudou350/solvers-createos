---
title: Tabular data, Excel Tables and PivotTables
source: Microsoft Support (Overview of Excel tables, Create and format tables; pt-BR pages) and Google Docs Editors Help (pivot tables)
source_url: https://support.microsoft.com/pt-br/office/vis%C3%A3o-geral-de-tabelas-do-excel-7ab0bb7d-3a9e-4b56-a3c9-6c94334e492c
source_date: 2026-10-02
tags: [tabela, tidy, tabela-dinamica, estrutura]
---

## The format that makes every analysis easier

One row per record (a sale, a customer, an entry), one column per variable (date, salesperson, amount) and one type per column. A header in a single row, no merged cells, no subtotal rows in the middle of the data and no months spread across columns ("Jan", "Feb", "Mar"...). Totals live outside the dataset, in another area or sheet, calculated by formula or PivotTable.

Signs that the dataset is not like this: sum formulas that have to be adjusted every month, a PivotTable that does not group, a filter that skips rows. Fixing the structure before writing a formula usually solves more than any new formula.

## Excel Table: growing on its own

To create one: select a cell inside the data and press Ctrl+T (or Home > Format as Table), checking that the table has headers. Microsoft describes that the table enables a filter on each header column and lets you sort and filter quickly. Formulas, PivotTables and charts based on the Table follow the new rows, and formulas can use structured references by column name (`Vendas[Valor]`) instead of fixed ranges.

Limitation: according to Microsoft, spilled array formulas (such as FILTER and UNIQUE) are not supported inside Excel Tables; write them outside the Table or convert the Table to a range.

## Unpivot: from months in columns to rows

A "wide" dataset (one month per column) is good for reading, not for analysis. To turn it into tabular format in Excel, the robust way is Power Query (Data > Get & Transform Data), which has an unpivot columns operation and redoes the result when the source changes; the exact names of the buttons vary with the version and the language. Without Power Query, a copy reorganized by hand works for small datasets. In Google Sheets, reorganizing by formula uses arrays and `ARRAYFORMULA`, or a query that stacks the columns.

## PivotTable

Good for exploring and for people who prefer not to write formulas: drag Salesperson to rows, Date (grouped by month and year) to columns and Amount to values with a sum. Conditions for it to work well: a tabular dataset, a single header with no blanks, a single type per column (a date stored as text does not group). For reports that must sit in a specific cell, with a fixed layout, prefer SUMIFS and COUNTIFS. PivotTables do not always update on their own when the file is opened: use Refresh when the dataset changes.

In Google Sheets: Insert > Pivot table, with similar options; the update is automatic.
