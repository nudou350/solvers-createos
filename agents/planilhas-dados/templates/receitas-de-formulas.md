# Formula recipes in English (commas) and Brazilian Portuguese (semicolons)

Adjust the ranges and the column names. The version is stated in each recipe; if the user has another one, use the alternative. Each recipe shows the English formula (arguments separated by commas) and, after "pt-BR", the same formula for a spreadsheet configured in Brazilian Portuguese (translated function names, arguments separated by semicolons). Use the one that matches the profile. The examples with `Vendas[Valor]` use Excel Table references (`Vendas` is the Table, `Valor` the column); without a Table (or in Google Sheets), use ranges such as `C2:C500`.

## Cross two tables

- Excel 2021, 2024, 365 and Sheets: `=XLOOKUP(A2,Clientes!A:A,Clientes!C:C,"not found")`. pt-BR: `=PROCX(A2;Clientes!A:A;Clientes!C:C;"não encontrado")`
- Any version: `=IFERROR(INDEX(Clientes!C:C,MATCH(A2,Clientes!A:A,0)),"not found")`. pt-BR: `=SEERRO(ÍNDICE(Clientes!C:C;CORRESP(A2;Clientes!A:A;0));"não encontrado")`
- If you get #N/A with the value "existing": test `=ISTEXT(A2)` in both sheets and `=LEN(A2)`. pt-BR: `=ÉTEXTO(A2)` and `=NÚM.CARACT(A2)`.

## Conditional sum, count and average

- Sum by salesperson: `=SUMIFS(Vendas[Valor],Vendas[Vendedor],A2)`. pt-BR: `=SOMASES(Vendas[Valor];Vendas[Vendedor];A2)`
- Sum by salesperson and period: `=SUMIFS(Vendas[Valor],Vendas[Vendedor],A2,Vendas[Data],">="&B1,Vendas[Data],"<="&C1)`. pt-BR: `=SOMASES(Vendas[Valor];Vendas[Vendedor];A2;Vendas[Data];">="&B1;Vendas[Data];"<="&C1)`
- Count: `=COUNTIFS(Vendas[Status],"Paid",Vendas[Vendedor],A2)`. pt-BR: `=CONT.SES(Vendas[Status];"Pago";Vendas[Vendedor];A2)`
- Percentage of the total (lock the sum with `$`): `=B2/SUM(B$2:B$50)`. pt-BR: `=B2/SOMA(B$2:B$50)`
- Weighted average: `=SUMPRODUCT(B2:B10,C2:C10)/SUM(C2:C10)`. pt-BR: `=SOMARPRODUTO(B2:B10;C2:C10)/SOMA(C2:C10)`
- Division without a divide-by-zero error: `=IF(C2=0,"",B2/C2)`. pt-BR: `=SE(C2=0;"";B2/C2)`

## Clean data

- Spaces (including the non-breaking one): `=TRIM(SUBSTITUTE(A2,CHAR(160)," "))`. pt-BR: `=ARRUMAR(SUBSTITUIR(A2;CARACT(160);" "))`
- Text to number: `=VALUE(TRIM(A2))`. pt-BR: `=VALOR(ARRUMAR(A2))`
- `dd/mm/yyyy` text to a date, without depending on the regional setting: `=DATE(RIGHT(A2,4),MID(A2,4,2),LEFT(A2,2))`; format the cell as a date. pt-BR: `=DATA(DIREITA(A2;4);EXT.TEXTO(A2;4;2);ESQUERDA(A2;2))`
- Leading zeros (8-digit Brazilian CEP): `=TEXT(A2,"00000000")`. pt-BR: `=TEXTO(A2;"00000000")`
- Split "Last name, First name" (Excel 365 and 2024 only): `=TEXTSPLIT(A2,", ")`. pt-BR: `=DIVIDIRTEXTO(A2;", ")`

## Lists and summaries

- Filter (Excel 2021 onwards): `=FILTER(A2:D500,C2:C500="Paid","nothing found")`. pt-BR: `=FILTRO(A2:D500;C2:C500="Pago";"nada encontrado")`
- Unique values without blanks (Excel 2021 onwards): `=UNIQUE(FILTER(A2:A500,A2:A500<>""))`. pt-BR: `=ÚNICO(FILTRO(A2:A500;A2:A500<>""))`
- Number of unique values: `=COUNTA(UNIQUE(FILTER(A2:A500,A2:A500<>"")))`. pt-BR: `=CONT.VALORES(ÚNICO(FILTRO(A2:A500;A2:A500<>"")))`
- Sum of one month, with cell `A2` holding the first day of the month: `=SUMIFS(Vendas[Valor],Vendas[Data],">="&A2,Vendas[Data],"<"&DATE(YEAR(A2),MONTH(A2)+1,1))`. pt-BR: `=SOMASES(Vendas[Valor];Vendas[Data];">="&A2;Vendas[Data];"<"&DATA(ANO(A2);MÊS(A2)+1;1))`

## Google Sheets (QUERY)

In QUERY the query text is the same in any language; only the argument separator of the QUERY function itself changes (comma in English, semicolon in Brazilian Portuguese).

- Total by salesperson and by month (data in A:C = Date, Salesperson, Amount, with a header): `=QUERY(A1:C,"select B, sum(C) where A is not null group by B pivot month(A)+1",1)`. pt-BR: `=QUERY(A1:C;"select B, sum(C) where A is not null group by B pivot month(A)+1";1)`. `month()` starts at zero, hence the `+1`.
- Only the paid ones, from largest to smallest: `=QUERY(A1:D,"select B, sum(D) where C = 'Paid' group by B order by sum(D) desc",1)`. pt-BR: `=QUERY(A1:D;"select B, sum(D) where C = 'Pago' group by B order by sum(D) desc";1)`
- Dates in the query: `where A >= date '2026-01-01'`; text in single quotes; decimals with a point.
