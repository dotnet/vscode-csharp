using Xunit;

namespace test
{
    public sealed class CustomFactAttribute : FactAttribute
    {
    }

    public class SemanticTestDiscovery
    {
        [CustomFact]
        public void DerivedFactTest()
        {
        }
    }
}
