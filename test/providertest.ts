import { should } from 'chai';
import { RemoteAttachPicker } from '../src/features/processPicker';

suite("Remote Process Picker: Validate quoting arguments.", () => {
    suiteSetup(() => should());
    test("Argument with no spaces", () => {
        let nonQuotedArg = RemoteAttachPicker.quoteArg("C:\\Users\\nospace\\program.exe");

        nonQuotedArg.should.deep.equal("C:\\Users\\nospace\\program.exe");
    });
});

