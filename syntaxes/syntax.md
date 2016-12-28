## TODO List:

* Declaratiosn:
    * Explicitly-implemented interface members
    * Constructor declarations
    * Destructor declarations
    * Method declarations
    * Operator declarations
    * Conversion operator declarations
    * Interface members

## Important regular expressions:

#### Identifier

* Expression: `[_$[:alpha:]][_$[:alnum:]]*`
* Matches: `_`, `Ident42`

#### Dotted name

* Expression: `([_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)`
* Matches: `System.Collections.Generic.Dictionary`

#### Simple generic name

* Expression: `(?<identifier>[_$[:alpha:]][_$[:alnum:]]*)(?:\s*<\s*\g<identifier>(?:\s*,\s*\g<identifier>)*\s*>\s*)?`
* Matches: `C<T, U, X>`

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

Note that fields can have multiple declarators with initializers. Our strategy is to match up to the end of the field name.
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

#### Property declarations

Note that properties can easily match other declarations unintentially. For example, "public class C {" looks a lot like the start of a property
if you consider that regular expressions don't know that "class" is a keyword. To handle this situation, we must use look ahead.

* Expression: `(?!.*\b(?:class|interface|struct|enum|event)\b)(?=\b(?<storage-modifiers>(?:(?:new|public|protected|internal|private|static|virtual|sealed|override|abstract|extern)\s+)*)\s*(?<type-name>(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?)\s+(?<property-name>[_$[:alpha:]][_$[:alnum:]]*)\s*(?:\{|=>|$))`
* Break down:
    * Don't match other declarations! `(?!.*\b(?:class|interface|struct|enum|event)\b)`
    * Storage modifiers: `\b(?<storage-modifiers>(?:(?:new|public|protected|internal|private|static|virtual|sealed|override|abstract|extern)\s+)*)`
    * Type name: `\s*(?<type-name>(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?)`
    * Property name: `\s+(?<property-name>[_$[:alpha:]][_$[:alnum:]]*)`
    * End: `\s*(?:\{|=>|$))`

#### Indexer declarations

* Expression: `(?=\b(?<storage-modifiers>(?:(?:new|public|protected|internal|private|virtual|sealed|override|abstract|extern)\s+)*)\s*(?<type-name>(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?)\s+(?<indexer-name>this)\s*(?:\[))`
* Break down:
    * Storage modifiers: `\b(?<storage-modifiers>(?:(?:new|public|protected|internal|private|virtual|sealed|override|abstract|extern)\s+)*)`
    * Type name: `\s*(?<type-name>(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?)`
    * Property name: `\s+(?<indexer-name>this)`
    * End: `\s*(?:\[))`