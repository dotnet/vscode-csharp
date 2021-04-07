using System;

namespace Test
{
    public class Definition
    {
        public static string Foo { get; set; }

        public void MyMethod()
        {
            Console.WriteLine(Foo);
        }
    }
}