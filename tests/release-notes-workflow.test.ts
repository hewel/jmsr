/* eslint-disable no-template-curly-in-string */
import { readFileSync } from 'node:fs';

import { expect, test } from '@rstest/core';

const readText = (path: string) => readFileSync(path, 'utf8');

test('release workflow uses local agent release notes and does not contain git-cliff or model API references', () => {
  const releaseWorkflow = readText('.github/workflows/release.yml');

  // Assert expected local agent release notes setup
  expect(releaseWorkflow).toContain('name: Load Local Agent Release Notes');
  expect(releaseWorkflow).toContain(
    'release_body: ${{ steps.release-notes.outputs.release_body }}',
  );
  expect(releaseWorkflow).toContain('body_file=".github/release-notes/${GITHUB_REF_NAME}.md"');
  expect(releaseWorkflow).toContain('IFS= read -r first_line < "$body_file"');
  expect(releaseWorkflow).toContain('if [ "$first_line" != "## ${GITHUB_REF_NAME}" ]; then');
  expect(releaseWorkflow).toContain('cat "$body_file"');
  expect(releaseWorkflow).toContain('body: ${{ needs.changelog.outputs.release_body }}');

  // Assert absence of git-cliff and model API remnants
  expect(releaseWorkflow).not.toContain('git-cliff-action');
  expect(releaseWorkflow).not.toContain('cliff.toml');
  expect(releaseWorkflow).not.toContain('models: read');
  expect(releaseWorkflow).not.toContain('models.github.ai');
  expect(releaseWorkflow).not.toContain('RELEASE_NOTES_MODEL');
});
