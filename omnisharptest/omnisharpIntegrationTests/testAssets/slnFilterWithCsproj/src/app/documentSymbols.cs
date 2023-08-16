using System;

namespace Test
{
    class C
    {
        private int _f;
        private int _f1, _f2;

        public C() {}
        ~C() { }

        public void M1(int i, string s, params object[] args)
        {
        }

        public int P1 => 42;
        public int P2 { get => 42; }
        public int P3 { get { return 42; } }

        public int this[int index] => index++;

        public event EventHandler E1;
        public event EventHandler E2, E3;
        public event EventHandler E4
        {
            add { }
            remove { }
        }

        public static bool operator ==(C c1, int i) { return true; }

        public static bool operator !=(C c1, int i) { return false; }

        public static implicit operator C(int i) { return null; }

        public static explicit operator int(C c1) { return 42 ; }
    }

    struct S
    {
    }

    interface I
    {
        void M();
    }

    delegate void D();

    enum E
    {
        One,
        Two,
        Three
    }
}