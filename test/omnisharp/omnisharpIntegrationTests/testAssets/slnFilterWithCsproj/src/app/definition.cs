using System;

namespace Test
{
    public partial class Definition
    {
        public static string Foo { get; set; }

        public void MyMethod()
        {
            Console.WriteLine(Foo);
        }
    }

    public partial class Definition { }
}
