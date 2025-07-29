
using System;

namespace Test
{
    public class LinkedList
    {
        public void MyMethod()
        {
            var linked = new LinkedList();
            var str = "test string";
            var part =  new PartialClass();
            Console.WriteLine(str);
        }
    }

    public partial class PartialClass {
        public string Foo {get; set;};
    }

    public partial class PartialClass {
        public int Bar {get; set;}
    }
}
