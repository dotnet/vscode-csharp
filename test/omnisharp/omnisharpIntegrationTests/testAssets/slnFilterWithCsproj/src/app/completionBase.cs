using singleCsproj2;

namespace singleCsproj
{
    class CompletionBase
    {
        public virtual void Method(NeedsImport n) {}
    }
}

namespace singleCsproj2
{
    class NeedsImport {}
}
