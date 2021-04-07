using System;

namespace minimal
{
    public class Foo 
    {
        public void Baz() {}
    }

    public class Bar 
    {
        public Bar()
        {
            new Foo().Baz();
        }
    }
}