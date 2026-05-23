export default {
  '{package,biome,tsconfig}.json':
    'biome check --write --no-errors-on-unmatched',
  '*.config.{js,json,jsonc,mjs,ts}':
    'biome check --write --no-errors-on-unmatched',
  'src/**/*.{css,js,jsx,json,jsonc,ts,tsx}':
    'biome check --write --no-errors-on-unmatched',
  'tests/**/*.{js,jsx,json,jsonc,ts,tsx}':
    'biome check --write --no-errors-on-unmatched',
  'src-tauri/**/*.json': 'biome check --write --no-errors-on-unmatched',
  'src-tauri/**/*.rs': () => 'cargo fmt --manifest-path src-tauri/Cargo.toml',
};
