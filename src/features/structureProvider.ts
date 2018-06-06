import { FoldingRangeProvider, TextDocument, FoldingContext, CancellationToken, FoldingRange, FoldingRangeKind } from "vscode";
import AbstractSupport from './abstractProvider';
import { blockStructure } from "../omnisharp/utils";
import { Request } from "../omnisharp/protocol";

export class StructureProvider extends AbstractSupport implements FoldingRangeProvider
{
    async provideFoldingRanges(document: TextDocument, context: FoldingContext, token: CancellationToken): Promise<FoldingRange[]> {
        let request: Request = {
            FileName: document.fileName,
        }
        
        let response = await blockStructure(this._server, request, token)
        let ranges : FoldingRange[] = [];
        for (let member of response.Spans)
        {
            ranges.push(new FoldingRange(member.Range.Start.Line - 1, member.Range.End.Line - 1, this.GetType(member.Type)))
        }

        return ranges;
    }

    GetType(type: string) : FoldingRangeKind
    {
        if (type == "Comment")
        {
            return FoldingRangeKind.Comment
        }
        else if (type == "Imports")
        {
            return FoldingRangeKind.Imports
        }
        else if (type == "Region")
        {
            return FoldingRangeKind.Region
        }

        return null;
    }

}