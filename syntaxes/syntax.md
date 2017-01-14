## Important regular expressions:

#### Identifier

* Expression: `[_[:alpha:]][_[:alnum:]]*`
* Matches: `_`, `Ident42`

#### Type name

```
(?<type-name>
    (?:
        (?:(?<identifier>[_[:alpha:]][_[:alnum:]]*)\s*\:\:\s*)? # alias-qualification
        (?<name-and-type-args> # identifier + type arguments (if any)
            \g<identifier>\s*
            (?<type-args>\s*<(?:[^<>]|\g<type-args>)+>\s*)?
        )
        (?:\s*\.\s*\g<name-and-type-args>)* # Are there any more names being dotted into?
        (?:\s*\*\s*)* # pointer suffix?
        (?:\s*\?\s*)? # nullable suffix?
        (?:\s*\[(?:\s*,\s*)*\]\s*)* # array suffix?
    )|
    (?<tuple>\s*\((?:[^\(\)]|\g<tuple>)+\))
)
```
