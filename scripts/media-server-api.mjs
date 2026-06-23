import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EMBY_SDK_TAG = '4.9.3.0';
const GLOBAL_PROPERTY = 'apiTests=false,modelTests=false,apiDocs=false,modelDocs=false';

const providers = {
  jellyfin: {
    specUrl: 'https://api.jellyfin.org/openapi/jellyfin-openapi-stable.json',
    snapshotPath: 'src-tauri/openapi/jellyfin-openapi-stable.json',
    configPath: 'src-tauri/openapi/jellyfin-api-generator.json',
    outputDir: 'src-tauri/media-server-api/jellyfin',
    userAgent: 'jmsr-openapi-snapshot',
    fetchError: 'Failed to fetch Jellyfin OpenAPI stable spec',
    afterGenerate: patchJellyfinGeneratedClient,
  },
  emby: {
    specUrl: `https://raw.githubusercontent.com/MediaBrowser/Emby.SDK/${EMBY_SDK_TAG}/Resources/OpenApi/openapi_v3.json`,
    snapshotPath: 'src-tauri/openapi/emby-openapi-4.9.3.0.json',
    configPath: 'src-tauri/openapi/emby-api-generator.json',
    outputDir: 'src-tauri/media-server-api/emby',
    userAgent: 'jellypilot-emby-openapi-snapshot',
    fetchError: 'Failed to fetch Emby OpenAPI spec',
    createGeneratorSpec: createPatchedEmbyGeneratorSpec,
  },
};

const providerName = process.argv[2];
const command = process.argv[3];
const provider = providers[providerName];

async function updateSnapshot() {
  const response = await fetch(provider.specUrl, {
    headers: { 'User-Agent': provider.userAgent },
  });

  if (!response.ok) {
    throw new Error(`${provider.fetchError}: ${response.status} ${response.statusText}`);
  }

  await writeFile(provider.snapshotPath, await response.text());
}

async function createPatchedEmbyGeneratorSpec() {
  const patchedSpecPath = join(tmpdir(), 'jellypilot-emby-openapi-4.9.3.0-generator.json');
  const spec = JSON.parse(await readFile(provider.snapshotPath, 'utf8'));
  const imagePath = spec.paths?.['/Users/{Id}/Images/{Type}/{Index}'];
  const indexParameter = imagePath?.delete?.parameters?.find(
    (parameter) => parameter?.name === 'Index' && parameter?.in === 'path',
  );
  const postParameters = imagePath?.post?.parameters;

  if (!indexParameter || !Array.isArray(postParameters)) {
    throw new Error('Emby OpenAPI image path patch target was not found');
  }

  if (postParameters.some((parameter) => parameter?.name === 'Index' && parameter?.in === 'path')) {
    throw new Error('Emby OpenAPI image path patch already applied upstream');
  }

  postParameters.push(indexParameter);
  await writeFile(patchedSpecPath, `${JSON.stringify(spec, null, 2)}\n`);
  return patchedSpecPath;
}

async function patchJellyfinGeneratedClient() {
  const path = `${provider.outputDir}/src/models/transcoding_info.rs`;
  const source = await readFile(path, 'utf8');
  const patched = source.replace(
    `pub enum TranscodeReasons {
}

impl Default for TranscodeReasons {
    fn default() -> TranscodeReasons {
        Self::
    }
}`,
    `pub enum TranscodeReasons {
    #[serde(other)]
    Unknown,
}

impl Default for TranscodeReasons {
    fn default() -> TranscodeReasons {
        Self::Unknown
    }
}`,
  );

  if (patched === source) {
    throw new Error('Generated TranscodeReasons patch did not apply');
  }

  await writeFile(path, patched);
}

async function runGenerator() {
  await rm(provider.outputDir, { force: true, recursive: true });
  const generatorSpecPath = provider.createGeneratorSpec
    ? await provider.createGeneratorSpec()
    : provider.snapshotPath;

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(
        'openapi-generator-cli',
        [
          'generate',
          '-i',
          generatorSpecPath,
          '-g',
          'rust',
          '-o',
          provider.outputDir,
          '-c',
          provider.configPath,
          '--global-property',
          GLOBAL_PROPERTY,
        ],
        { stdio: 'inherit' },
      );

      child.on('error', reject);
      child.on('exit', (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`openapi-generator-cli exited with ${signal ?? code}`));
      });
    });
  } finally {
    if (generatorSpecPath !== provider.snapshotPath) {
      await rm(generatorSpecPath, { force: true });
    }
  }

  await provider.afterGenerate?.();
}

function printUsage() {
  console.error('Usage: bun scripts/media-server-api.mjs <jellyfin|emby> <generate|update>');
}

if (!provider || (command !== 'generate' && command !== 'update')) {
  printUsage();
  process.exitCode = 1;
} else if (command === 'generate') {
  await runGenerator();
} else {
  await updateSnapshot();
  await runGenerator();
}
