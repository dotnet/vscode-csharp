module.exports = function(wallaby) {
  return {
    env: {
      type: "node"
    },
    files: [
      "src/**/*.ts*",
      "src/**/*.css",
      "test/unitTests/**/*.ts*",
      "!test/unitTests/**/*.test.ts*"
    ],
    tests: ["test/unitTests/**/*.test.ts*"],

    debug: true,

    setup: function(wallaby) {
      wallaby.testFramework.ui("tdd");
    }
  };
};
