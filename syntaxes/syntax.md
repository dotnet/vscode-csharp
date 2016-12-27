Important regular expressions:

#### Identifier

* Expression: `[_$[:alpha:]][_$[:alnum:]]*`
* Matches: `_`, `Ident42`

#### Dotted name

* Expression: `([_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)`
* Matches: `System.Collections.Generic.Dictionary`

#### Generic name

* Expression: `(?<generic-name>(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<generic-name>)(?:\s*,\s*\g<generic-name>)*\s*>\s*)?)`
* Matches: `System.Collections.Generic.Dictionary<int, System.List<object>>`

#### Array suffix

* Expression: `(?:(?:\[,*\])*)`
* Matches: `[][,][,,]`

#### Pointer suffix

* Expression: `(?:(?:\*)*)?`
* Matches: `int*`

#### Type name

* Expression: `(?<type-name>(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?)`
* Matches: `System.Collections.Generic.Dictionary<Dictionary<int, string[]>, System.List<Dictionary<int*[,,], int>>>`

#### Field declaratiosn

The strategy for field declarations is to match up to the end of the field name. Note that this is the first field name in the case of multiple declarators.
Further field names are matched by looking for identifiers, #punctuation-comma, and #variable-initializer.

* Expression: `(?=\b(?<storage-modifiers>(?:(?:new|public|protected|internal|private|static|readonly|volatile|const)\s+)*)\s*(?<type-name>(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?)\s+(?<first-field-name>[_$[:alpha:]][_$[:alnum:]]*)\s*(?!=>)(?:;|=))`
* Break down:
    * Storage modifiers: `\b(?<storage-modifiers>(?:(?:new|public|protected|internal|private|static|readonly|volatile|const)\s+)*)`
    * Type name: `\s*(?<type-name>(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?)`
    * First field name: `\s+(?<first-field-name>[_$[:alpha:]][_$[:alnum:]]*)*)`
    * End: `\s*(?!=>)(?:;|=)`

#### Event declarations

* Expression: `(?=\b(?<storage-modifiers>(?:(?:new|public|protected|internal|private|static|virtual|sealed|override|abstract|extern)\s+)*)\s*\b(?<event-keyword>event)\b\s*(?<type-name>(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?)\s+(?<event-names>[_$[:alpha:]][_$[:alnum:]]*(?:\s*,\s*[_$[:alpha:]][_$[:alnum:]]*)*)\s*(?:\{|;|$))`
* Break down:
    * Storage modifiers: `\b(?<storage-modifiers>(?:(?:new|public|protected|internal|private|static|virtual|sealed|override|abstract|extern)\s+)*)`
    * Event keyword: `\s*\b(?<event-keyword>event)\b`
    * Type name: `\s*(?<type-name>(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?)`
    * Event name(s): `\s+(?<event-names>[_$[:alpha:]][_$[:alnum:]]*(?:\s*,\s*[_$[:alpha:]][_$[:alnum:]]*)*)`
    * End: `\s*(?=\{|;|$)`