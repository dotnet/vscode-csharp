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

* Expression: `(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)`
* Matches: `System.Collections.Generic.Dictionary<Dictionary<int, string[]>, System.List<Dictionary<int*[,,], (int i, System.String[] s)>>>`

#### Delegate declarations

* Expression: `(?=(?<storage-modifiers>(?:(?:new|public|protected|internal|private)\s+)*)(?<delegate-keyword>(?:\b(?:delegate)))\s+(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)\s+(?<delegate-name>(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*<\s*(?:(?:(?:in|out)\s+)?[_$[:alpha:]][_$[:alnum:]]*)(?:,\s*(?:(?:in|out)\s+)?[_$[:alpha:]][_$[:alnum:]]*)*\s*>\s*)?))\s*(?:\())`
* Matches: `delegate (int, int) Foo<in T, out U>();`

#### Field declaratiosn

Note that fields can have multiple declarators with initializers. Our strategy is to match up to the end of the field name.
Further field names are matched by looking for identifiers, #punctuation-comma, and #variable-initializer.

* Expression: `(?=(?<storage-modifiers>(?:(?:new|public|protected|internal|private|static|readonly|volatile|const)\s+)*)\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)\s+(?<first-field-name>[_$[:alpha:]][_$[:alnum:]]*)\s*(?!=>|==)(?:;|=))`
* Break down:
    * Storage modifiers: `(?<storage-modifiers>(?:(?:new|public|protected|internal|private|static|readonly|volatile|const)\s+)*)`
    * Type name: `\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)`
    * First field name: `\s+(?<first-field-name>[_$[:alpha:]][_$[:alnum:]]*)*)`
    * End: `\s*(?!=>)(?:;|=)`

#### Event declarations

* Expression: `(?=(?<storage-modifiers>(?:\b(?:new|public|protected|internal|private|static|virtual|sealed|override|abstract|extern)\b\s*)*)\s*\b(?<event-keyword>event)\b\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)\s+(?:(?<interface-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<interface-name>)(?:\s*,\s*\g<interface-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<interface-name>)*)|(?:\s*\(\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)(\s*\.\s*))?(?<event-names>[_$[:alpha:]][_$[:alnum:]]*(?:\s*,\s*[_$[:alpha:]][_$[:alnum:]]*)*)\s*(?:\{|;|$))`
* Break down:
    * Storage modifiers: `(?<storage-modifiers>(?:\b(?:new|public|protected|internal|private|static|virtual|sealed|override|abstract|extern)\b\s*)*)`
    * Event keyword: `\s*\b(?<event-keyword>event)\b`
    * Type name: `\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)`
    * Interface name: `\s+(?:(?<interface-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<interface-name>)(?:\s*,\s*\g<interface-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<interface-name>)*)|(?:\s*\(\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)(\s*\.\s*))?`
    * Event name(s): `(?<event-names>[_$[:alpha:]][_$[:alnum:]]*(?:\s*,\s*[_$[:alpha:]][_$[:alnum:]]*)*)`
    * End: `\s*(?:\{|;|$)`

#### Property declarations

Note that properties can easily match other declarations unintentially. For example, "public class C {" looks a lot like the start of a property
if you consider that regular expressions don't know that "class" is a keyword. To handle this situation, we must use look ahead.

* Expression: `(?!.*\b(?:class|interface|struct|enum|event)\b)(?=(?<storage-modifiers>(?:\b(?:new|public|protected|internal|private|static|virtual|sealed|override|abstract|extern)\b\s*)*)\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)\s+(?:(?<interface-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<interface-name>)(?:\s*,\s*\g<interface-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<interface-name>)*)|(?:\s*\(\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)(\s*\.\s*))?(?<property-name>[_$[:alpha:]][_$[:alnum:]]*)\s*(?:\{|=>|$))`
* Break down:
    * Don't match other declarations! `(?!.*\b(?:class|interface|struct|enum|event)\b)`
    * Storage modifiers: `(?<storage-modifiers>(?:\b(?:new|public|protected|internal|private|static|virtual|sealed|override|abstract|extern)\b\s*)*)`
    * Type name: `\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)`
    * Interface name: `\s+(?:(?<interface-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<interface-name>)(?:\s*,\s*\g<interface-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<interface-name>)*)|(?:\s*\(\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)(\s*\.\s*))?`
    * Property name: `(?<property-name>[_$[:alpha:]][_$[:alnum:]]*)`
    * End: `\s*(?:\{|=>|$)`

#### Indexer declarations

* Expression: `(?=(?<storage-modifiers>(?:\b(?:new|public|protected|internal|private|virtual|sealed|override|abstract|extern)\b\s*)*)\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)\s+(?:(?<interface-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<interface-name>)(?:\s*,\s*\g<interface-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<interface-name>)*)|(?:\s*\(\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)(\s*\.\s*))?(?<indexer-name>this)\s*(?:\[))`
* Break down:
    * Storage modifiers: `(?<storage-modifiers>(?:\b(?:new|public|protected|internal|private|virtual|sealed|override|abstract|extern)\b\s*)*)`
    * Type name: `\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)`
    * Interface name: `\s+(?:(?<interface-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<interface-name>)(?:\s*,\s*\g<interface-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<interface-name>)*)|(?:\s*\(\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)(\s*\.\s*))?`
    * Indexer name: `(?<indexer-name>this)`
    * End: `\s*(?:\[)`

#### Method declarations

* Expression: `(?=(?<storage-modifiers>(?:\b(?:new|public|protected|internal|private|static|virtual|sealed|override|abstract|extern|async|partial)\b\s*)*)\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)\s+(?:(?<interface-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<interface-name>)(?:\s*,\s*\g<interface-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<interface-name>)*)|(?:\s*\(\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)(\s*\.\s*))?(?<method-name>(?<identifier>[_$[:alpha:]][_$[:alnum:]]*)(?:\s*<\s*\g<identifier>(?:\s*,\s*\g<identifier>)*\s*>\s*)?)\s*(?:\())`

* Break down:
    * Storage modifiers: `(?<storage-modifiers>(?:\b(?:new|public|protected|internal|private|static|virtual|sealed|override|abstract|extern|async|partial)\b\s*)*)`
    * Type name: `\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)`
    * Interface name: `\s+(?:(?<interface-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<interface-name>)(?:\s*,\s*\g<interface-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<interface-name>)*)|(?:\s*\(\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<interface-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)(\s*\.\s*))?`
    * Method name and type parameters: `(?<method-name>(?<identifier>[_$[:alpha:]][_$[:alnum:]]*)(?:\s*<\s*\g<identifier>(?:\s*,\s*\g<identifier>)*\s*>\s*)?)`
    * End: `\s*(?:\()`

#### Constructor declarations

Note that the match for constructor declarations contains an `|`. This allows for constructors with and without storage modifiers.
If the storage modifiers are optional (i.e. using a `*` rather than a `+`), this match conflicts with fields where there is a modifier
followed by a tuple type (e.g. `private (int, int) x;`).

* Expression: `(?=(?:(?<storage-modifiers>(?:(?:public|protected|internal|private|extern|static)\s+)+)\s*(?:[_$[:alpha:]][_$[:alnum:]]*)|(?:[_$[:alpha:]][_$[:alnum:]]*))\s*(?:\())`
* Break down:
    * Storage modifiers: `(?<storage-modifiers>(?:(?:public|protected|internal|private|extern|static)\s+)*)`
    * Name: `\s+[_$[:alpha:]][_$[:alnum:]]*`
    * End: `\s*(?:\()`

#### Destructor declarations

Note that structs do not allow destructor declarations, but we'll try to highlight them anyway.

* Expression: `(?=~(?:[_$[:alpha:]][_$[:alnum:]]*)\s*(?:\())`
* Break down:
    * Name: `~(?:[_$[:alpha:]][_$[:alnum:]]*)`
    * End: `\s*(?:\()`

#### Operator declarations

* Expression: `(?=(?<storage-modifiers>(?:(?:public|static|extern)\s+)*)\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)\s*(?<operator-keyword>(?:\b(?:operator)))\s*(?<operator>(?:\+|-|\*|\/|%|&|\\||\^|\<\<|\>\>|==|!=|\>|\<|\>=|\<=|!|~|\+\+|--|true|false))\s*(?:\())`
* Break down:
    * Storage modifiers: `(?<storage-modifiers>(?:(?:public|static|extern)\s+)*)`
    * Type name: `\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)`
    * Operator keyword: `\s*(?<operator-keyword>(?:\b(?:operator)))`
    * Operator: `\s*(?<operator>(?:\+|-|\*|\/|%|&|\\||\^|\<\<|\>\>|==|!=|\>|\<|\>=|\<=|!|~|\+\+|--|true|false))`
    * End: `\s*(?:\()`

#### Conversion operator declarations

* Expression: `(?=(?<storage-modifiers>(?:(?:public|static|extern)\s+)*)\s*(?<explicit-or-implicit-keyword>(?:\b(?:explicit|implicit)))\s*(?<operator-keyword>(?:\b(?:operator)))\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)\s*(?:\())`
* Break down:
    * Storage modifiers: `(?<storage-modifiers>(?:(?:public|static|extern)\s+)*)`
    * Explicit or implicit: `\s*(?<explicit-or-implicit-keyword>(?:\b(?:explicit|implicit)))`
    * Operator keyword: `\s*(?<operator-keyword>(?:\b(?:operator)))`
    * Type name: `\s*(?<type-name>(?:(?:[_$[:alpha:]][_$[:alnum:]]*\s*\:\:\s*)?(?:(?:[_$[:alpha:]][_$[:alnum:]]*(?:\s*\.\s*[_$[:alpha:]][_$[:alnum:]]*)*)(?:\s*<\s*(?:\g<type-name>)(?:\s*,\s*\g<type-name>)*\s*>\s*)?(?:(?:\*)*)?(?:(?:\[,*\])*)?(?:\s*\.\s*\g<type-name>)*)|(?:\s*\(\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?(?:\s*,\s*(?:\g<type-name>)(?:\s+[_$[:alpha:]][_$[:alnum:]]*)?)*\s*\)\s*))(?:(?:\[,*\])*)?)`
    * End: `\s*(?:\()`
