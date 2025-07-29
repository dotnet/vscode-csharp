using System;
using System.Collections.Generic;
using System.Text;

namespace app
{
    public class GeneratorTrigger
    {
        // Generator creates GeneratedCode.S, with the same initializer.
        public string S = "Hello world!";

        public string S2 = GeneratedCode.S;
    }
}
