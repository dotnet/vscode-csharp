import { FoldingRangeProvider, TextDocument, FoldingContext, CancellationToken, FoldingRange } from "vscode";
import AbstractSupport from './abstractProvider';
import { blockStructure } from "../omnisharp/utils";
import { Request } from "../omnisharp/protocol";

export class structureProvider extends AbstractSupport implements FoldingRangeProvider
{
    async provideFoldingRanges(document: TextDocument, context: FoldingContext, token: CancellationToken): Promise<FoldingRange[]> {
        let request: Request = {
            FileName: document.fileName,
        }
        
        let response = await blockStructure(this._server, request, token)
        let ranges : FoldingRange[] = [];
        for (let member of response.Spans)
        {
            ranges.push(new FoldingRange(member.TextSpan.Start.Line - 1, member.TextSpan.End.Line - 1))
        }

        return ranges;
    }

}