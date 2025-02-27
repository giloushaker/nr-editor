const { defineConfig } = require("windicss/helpers");
module.exports = defineConfig({
  preflight: false,
  corePlugins: {
    container: false,
  },
});
