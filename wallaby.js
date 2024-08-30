module.exports = function(_wallaby) {
  return {
    env: {
      type: "node"
    },
    files: [
      "src/**/*.ts*",
      "src/**/*.css",
      "omnisharptest/omnisharpUnitTests/**/*.ts*",
      "!omnisharptest/omnisharpUnitTests/**/*.test.ts*"
    ],
    tests: ["omnisharptest/omnisharpUnitTests/**/*.test.ts*"],

    debug: true,

    setup: function(wallaby) {
      wallaby.testFramework.ui("tdd");
    }
  };
};
