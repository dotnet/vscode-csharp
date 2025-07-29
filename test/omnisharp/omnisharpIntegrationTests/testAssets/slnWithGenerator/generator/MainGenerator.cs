using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace generator
{
    [Generator]
    public class MainGenerator : ISourceGenerator
    {
        public void Execute(GeneratorExecutionContext context)
        {
            context.AddSource("GeneratedCode", @"namespace app
{
    class GeneratedCode
    {
        public static string S = " + ((Receiver)context.SyntaxReceiver).ConstantValue + @";
    }
}");
        }

        public void Initialize(GeneratorInitializationContext context)
        {
            context.RegisterForSyntaxNotifications(new SyntaxReceiverCreator(() => new Receiver()));
        }

        private class Receiver : ISyntaxReceiver
        {
            internal string ConstantValue;

            public void OnVisitSyntaxNode(SyntaxNode syntaxNode)
            {
                if (!syntaxNode.SyntaxTree.FilePath.EndsWith("GeneratorTrigger.cs") || syntaxNode is not LiteralExpressionSyntax { RawKind: (int)SyntaxKind.StringLiteralExpression } literal)
                {
                    return;
                }

                ConstantValue = literal.ToString();
            }
        }
    }
}
