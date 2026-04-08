import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        console: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        HTMLImageElement: "readonly",
      },
    },
  },
  {
    ignores: ["dist/", "node_modules/"],
  },
];
