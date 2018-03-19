using System;
namespace Test
{
    class sigHelp
    {
        ///<summary>DoWork is some method.</summary>
        /// <param name="Int1">Used to indicate status.</param>
        /// <param name="Float1">Used to specify context.</param>
        public static void DoWork(int Int1, float Float1, double Double1)
        {
        }

        public static void noDocMethod()
        {
        }

        public static void main()
        {
            DoWork(4, 4.0f, 5.0);
            noDocMethod();
        }
    }
}