# ANSI display normalization

Raw stored output -> displayOutput -> React text/code surface. Database records are never rewritten. The existing installed ansi-regex 5.0.1 utility was promoted to an explicit pinned frontend dependency, with its existing lock entry retained. The small shared wrapper also removes OSC hyperlinks terminated by BEL/ST and remaining nonprinting C0/C1 controls while preserving line breaks, tabs, Unicode and ordinary text.

The same display function covers stdout, stderr, diagnostic fields, error parsing and timeline output/excerpts. React continues rendering plain text, never raw HTML. Technical error details show normalized original stderr and source metadata. A nested, default-collapsed Raw terminal evidence disclosure preserves exact stderr/errorMessage through JSON escaping; control values remain inspectable without terminal sequences entering the normal display.

Seven normalization fixtures cover colored Deno errors, repeated sequences, plain text, multiline output, Unicode, empty input and OSC hyperlinks. Historical ANSI stderr was opened in the browser and copied as normalized text. The stored historical record remains unchanged.
