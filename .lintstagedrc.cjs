/** Run ESLint + Prettier on staged files. Per REQ-5.7. */
module.exports = {
  '*.{ts,tsx,js,jsx,mjs,cjs}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,mdx,yml,yaml}': ['prettier --write'],
};
