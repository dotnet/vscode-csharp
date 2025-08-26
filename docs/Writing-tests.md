### Writing tests in omnisharp-vscode


Tests in the omnisharp vscode use the [Mocha](https://mochajs.org/) framework and the [Chai](https://www.chaijs.com/) assertion library frameworks. To run all the tests for the repo use : `npm run test`.

The repo mainly has the following three categories of tests:

#### [Unit Tests](https://github.com/OmniSharp/omnisharp-vscode/tree/master/test/unitTests)
These are the tests that run in isolation and do not need a vscode environment to run within. These tests are the fastest and usually use fake/mocks to test the components completely in isolation. These tests can be run in several ways:

1. npm run test:unit
2. npm run test:tdd - Run tests in watch mode, so as you make the changes to your files, you can continuously see the tests failing/passing
3. Using [Wallaby.js](https://wallabyjs.com/)
#### [Feature Tests](https://github.com/OmniSharp/omnisharp-vscode/tree/master/test/featureTests)
These tests need to be run inside a vscode instance as they rely on the vscode API's. However, they do not test for the language services or the debugger services so they don't rely on external processes like OmniSharp or Debugger.
To run these tests use `npm run test:feature`

#### [Integration Tests](https://github.com/OmniSharp/omnisharp-vscode/tree/master/test/integrationTests)
These tests are close to end-to-end tests and require to start the OmniSharp or the debugger process and are hence the slowest. 

Currently, there are two sample folders in the assets for the integration tests. These represent two sample workspace types:

1. [Workspace with a single project](https://github.com/OmniSharp/omnisharp-vscode/tree/master/test/integrationTests/testAssets/singleCsproj)
2. [A more complex workspace with multiple solutions and projects](https://github.com/OmniSharp/omnisharp-vscode/tree/master/test/integrationTests/testAssets/slnWithCsproj)

To write these tests for the language services features like "Signature Help" of "Completion", we need to wait for the "OmniSharp" server to start in the setup of the tests, so that the server is running and requests can be sent to it for the appropriate language service. To understand these tests better please refer to the [vscode complex API commands](https://code.visualstudio.com/docs/extensionAPI/vscode-api-commands).

To run these tests use `npm run test:integration`

##### Using the VSCode Debug Menu to run the tests
When the folder is opened in VSCode, the tests can also be run selecting the appropriate option from the "Debug" menu. The advantage of using this approach is that we can set breakpoints to debug the tests when using this approach.
