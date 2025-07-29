module.exports = function(_wallaby) {
  return {
    env: {
      type: "node"
    },
    files: [
      "src/**/*.ts*",
      "src/**/*.css",
      "test/omnisharp/omnisharpUnitTests/**/*.ts*",
      "!test/omnisharp/omnisharpUnitTests/**/*.test.ts*"
    ],
    tests: ["test/omnisharp/omnisharpUnitTests/**/*.test.ts*"],

    debug: true,

    setup: function(wallaby) {
      wallaby.testFramework.ui("tdd");
    }
  };
};
