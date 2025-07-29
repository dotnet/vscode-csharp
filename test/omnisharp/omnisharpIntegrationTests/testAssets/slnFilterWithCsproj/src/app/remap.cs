namespace Remap
{
    public class Foo
    {
        public static string Bar { get; set; }
        
        public void Baz()
        {
            var x = nameof(Bar);
        }
    }
}