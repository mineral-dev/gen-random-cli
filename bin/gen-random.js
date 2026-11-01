#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');

const DEFAULT_SETTINGS = {
  prefix: 'sk_',
};

const OUTPUT_SIZES = [
  { targetBits: 128, totalChars: 32, minRandomHexLength: 28 },
  { targetBits: 256, totalChars: 64, minRandomHexLength: 32 },
];
const settingsPath = path.join(os.homedir(), '.config', 'gen-random-cli', 'settings.json');

function isValidSettings(settings) {
  return typeof settings?.prefix === 'string'
    && /^[\x20-\x7E]*$/.test(settings.prefix);
}

function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const settings = {
      prefix: saved?.prefix ?? DEFAULT_SETTINGS.prefix,
    };
    if (!isValidSettings(settings)) {
      return { ...DEFAULT_SETTINGS };
    }
    return settings;
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      return { ...DEFAULT_SETTINGS };
    }
    throw error;
  }
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${settingsPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporaryPath, settingsPath);
}

function drawSettingsMenu(settings, notice = '') {
  process.stdout.write('\u001b[2J\u001b[H');
  process.stdout.write('gen-random settings\n');
  process.stdout.write('Type a printable ASCII prefix   Backspace delete   Enter save   Esc cancel\n\n');
  process.stdout.write(`Prefix: ${settings.prefix || '(empty)'}\n`);
  if (notice) process.stdout.write(`\n${notice}\n`);
}

function runSettingsMenu(settings) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Settings require an interactive terminal.');
  }

  return new Promise((resolve) => {
    const input = process.stdin;
    const output = process.stdout;
    const previousRawMode = input.isRaw;
    const rl = readline.createInterface({ input, output });
    readline.emitKeypressEvents(input, rl);
    input.setRawMode(true);
    input.resume();

    let notice = '';
    let finished = false;

    const finish = (result) => {
      if (finished) return;
      finished = true;
      input.removeListener('keypress', onKeypress);
      input.setRawMode(Boolean(previousRawMode));
      rl.close();
      output.write('\u001b[2J\u001b[H');
      resolve(result);
    };

    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        finish(null);
        return;
      }

      if (key.name === 'escape') {
        finish(null);
        return;
      }
      if (key.name === 'backspace' || key.name === 'delete') {
        settings.prefix = [...settings.prefix].slice(0, -1).join('');
        notice = '';
      } else if (key.name === 'return') {
        if (isValidSettings(settings)) finish(settings);
        else notice = 'Prefix can contain printable ASCII characters only.';
        return;
      } else if (!key.ctrl && !key.meta && typeof character === 'string' && /^[\x20-\x7E]$/.test(character)) {
        settings.prefix += character;
        notice = '';
      }

      drawSettingsMenu(settings, notice);
    };

    input.on('keypress', onKeypress);
    drawSettingsMenu(settings);
  });
}

function printUsage() {
  process.stdout.write('gen-random - secure random hexadecimal values\n\n');
  process.stdout.write('Usage:\n');
  process.stdout.write('  gen-random [--bits 128|256] [--prefix <text>]\n');
  process.stdout.write('  gen-random settings\n');
  process.stdout.write('  gen-random --help\n\n');
  process.stdout.write('Options:\n');
  process.stdout.write('  --bits <128|256>   Print only the selected format.\n');
  process.stdout.write('  --prefix <text>    Override the prefix for this run.\n');
  process.stdout.write('  settings           Edit and save the default prefix.\n');
  process.stdout.write('  -h, --help          Show this help.\n');
  process.stdout.write('  -V, --version       Show the installed version.\n\n');
  process.stdout.write('With no size option, both formats are printed. The default prefix is sk_.\n');
}

async function main() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.length === 1 && (argumentsList[0] === '--help' || argumentsList[0] === '-h')) {
    printUsage();
    return;
  }
  if (argumentsList.length === 1 && (argumentsList[0] === '--version' || argumentsList[0] === '-V')) {
    const packageJson = require('../package.json');
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }
  if (argumentsList.length === 1 && argumentsList[0] === 'settings') {
    const settings = loadSettings();
    const result = await runSettingsMenu(settings);
    if (result) {
      saveSettings(result);
      process.stdout.write(`Settings saved to ${settingsPath}\n`);
    }
    return;
  }

  let selectedBits = 'both';
  let bitsWereSelected = false;
  let prefixOverride;
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--bits') {
      if (bitsWereSelected) throw new Error('Use --bits only once.');
      const value = argumentsList[index + 1];
      if (value !== '128' && value !== '256') throw new Error('--bits must be 128 or 256.');
      selectedBits = value;
      bitsWereSelected = true;
      index += 1;
    } else if (argument === '--prefix') {
      if (index + 1 >= argumentsList.length) throw new Error(`${argument} requires a value.`);
      prefixOverride = argumentsList[index + 1];
      if (!/^[\x20-\x7E]*$/.test(prefixOverride)) {
        throw new Error('Prefix can contain printable ASCII characters only.');
      }
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  const settings = loadSettings();
  if (prefixOverride !== undefined) settings.prefix = prefixOverride;
  const selectedSizes = selectedBits === '128'
    ? OUTPUT_SIZES.slice(0, 1)
    : selectedBits === '256'
      ? OUTPUT_SIZES.slice(1)
      : OUTPUT_SIZES;

  for (const { targetBits, totalChars, minRandomHexLength } of selectedSizes) {
    const randomHexLength = Math.max(totalChars - settings.prefix.length, minRandomHexLength);
    const randomHex = crypto.randomBytes(Math.ceil(randomHexLength / 2)).toString('hex').slice(0, randomHexLength);
    const value = `${settings.prefix}${randomHex}`;
    process.stdout.write(`${targetBits} bits (${value.length} chars): ${value}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`gen-random: ${error.message}\n`);
  process.exitCode = 1;
});
