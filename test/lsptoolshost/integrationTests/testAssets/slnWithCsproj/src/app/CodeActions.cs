using System;

namespace CodeActionsTests;

class CodeActions
{
    static void Do() { Method(); }
    static void Method()
    {
        var x = 1;
        Do();
    }
}