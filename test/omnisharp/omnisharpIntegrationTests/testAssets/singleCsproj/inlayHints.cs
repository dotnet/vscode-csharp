using System;

class InlayHints
{
    public void M()
    {
        var l1 = new InlayHints();
        InlayHints l2 = new();
        Action<string> a = (s) => { };
        _ = this[1];
        _ = M1(1);
        _ = new InlayHints(1);
        _ = M2(1, 2); // No hint here, suppressForParametersThatDifferOnlyBySuffix

        int param1 = 1;
        _ = M1(param1); // No hint here, suppressForParametersThatMatchArgumentName

        _ = EnableM(true); // No hint here, suppressForParametersThatMatchMethodIntent
    }

    public void M1(int param1) { }
    public void M2(int param1, int param2) { }
    public void EnableM(bool enable) { }

    public int this[int i] { get { return 0; } set { } }

    public InlayHints() {}
    public InlayHints(int param1) {}
}
