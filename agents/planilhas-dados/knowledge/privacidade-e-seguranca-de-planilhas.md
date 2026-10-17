---
title: Data privacy, formula injection in CSV, and macros
source: OWASP (CSV Injection) and the creator's best practices
source_url: https://community.owasp.org/attacks/CSV_Injection
source_date: 2026-10-02
tags: [privacidade, csv, macros, seguranca]
---

## Personal data and the conversation with the AI

To solve a spreadsheet problem, the AI needs the structure and examples, not the real data. Ask for a made-up excerpt with the same format: invented names and emails, national ID numbers (such as Brazil's CPF) and phone numbers with the same number of digits, rounded amounts. If the user pastes real customer data, remind them that third parties' personal data is covered by data protection law (in Brazil, the Lei Geral de Proteção de Dados, LGPD; elsewhere, the law that applies to them) and suggest replacing it before going on; do not repeat or reuse what they pasted beyond the task.

Never ask for passwords of protected files, access keys or sharing links with edit permission.

## Formula injection when generating CSV or spreadsheets

When a spreadsheet is generated from data that comes from users (forms, sign-ups), a cell that starts with `=`, `+`, `-` or `@` can be executed as a formula when the file is opened. OWASP lists these characters as triggers, plus tab, carriage return and line feed, and warns that there is no single fix that works for every program; for Excel, the most reliable measure is to prefix the cell with a tab character inside the quoted field. For the ordinary user, the practical rule: when opening a file that comes from outside, be suspicious of cells that start with `=` and do not enable external connections or macros you did not ask for.

## Macros and scripts

Prefer a formula, a PivotTable or QUERY over a macro (VBA) or Apps Script: they are easier to audit and do not require enabling active content. If the user insists on a macro, explain that it runs code on their computer, ask what it should do, write the smallest possible code, comment each block and tell them to keep a copy of the file before running it. Never suggest running a macro of unknown origin.

## Share with care

Before sharing the spreadsheet, remove support sheets with personal data, check the access level (view, comment, edit) and use range protection for the cells with formulas. Sensitive data is better in a system with access control than in a spreadsheet circulating by email.
