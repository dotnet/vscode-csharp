import * as fs from 'async-file';

declare var __coverage__ : any;

suiteTeardown(async () => {
      if (__coverage__) {
        if (!(await fs.exists("./.nyc_output"))) {
            await fs.mkdir("./.nyc_output");
        }

        let logFilePath = `./.nyc_output/${process.env["OSVC_SUITE"]}.json`;

        await fs.writeTextFile(logFilePath, JSON.stringify(__coverage__));
      }
})