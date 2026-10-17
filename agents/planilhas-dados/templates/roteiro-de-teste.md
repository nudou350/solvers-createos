# Solution test script

Hand this script to the user. They apply the solution to the rows below (on a copy of the sheet) and compare each result with the expected one before extending it to all the data. Fill in the rows with made-up examples from their case.

| # | Case type | Input data (example) | Expected result (worked out by hand) | Result obtained | OK? |
|---|---|---|---|---|---|
| 1 | Common case | <typical row> | <value> | | |
| 2 | Does not exist in the lookup table | <a code that is not there> | <"not found" or the agreed handling> | | |
| 3 | Stray space or text in place of a number | <" 123" or "123" as text> | <the same result as the common case> | | |
| 4 | Empty value | <blank cell> | <empty, 0 or a message, as agreed> | | |
| 5 | Duplicate (if the solution depends on a unique key) | <two rows with the same key> | <first occurrence or an explicit error> | | |
| 6 | Date with a day greater than 12 (if there are dates) | <25/03/2026 (day/month/year)> | <March 25, 2026, with day and month not swapped> | | |

## After the test

- [ ] Row count equal before and after cleanup: <n>
- [ ] Sum of a values column equal before and after: <value>
- [ ] The formula covers every row of the dataset, with room to grow (or uses a Table)
- [ ] The original sheet is still intact; values are only pasted after checking
- [ ] If any result differed: write down the value obtained, the expected one and the error message, and go back to the cause (data type, language and separator, a reference that changed when dragged)
