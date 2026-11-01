# gen-random-cli

Generate cryptographically secure random hexadecimal values locally from your terminal. After installation, the command works offline: it makes no network requests and includes no tracking or telemetry. It prints both the 128-bit and 256-bit formats by default.

## Security and privacy

Random bytes are generated locally with Node.js `crypto.randomBytes()`, which Node documents as providing cryptographically strong pseudorandom data ([Node.js crypto documentation](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback)). After installation, the generator works offline: it makes no network requests and includes no tracking, telemetry, analytics, or third-party runtime dependencies.

Generated values are printed to the terminal and are not written to files by the CLI. The settings file stores only the prefix. The source is small and available for inspection under the MIT license.

## Requirements

- Node.js 22 or newer

## Install

```sh
npm install --global gen-random-cli
```

This installs the commands `gen-random-cli`, `gen-random`, and `genran` locally on your system. To run a command through npm without a global install, use the explicit package option:

```sh
npx --package gen-random-cli genran --help
```

`npx genran` asks npm for the separate package named `genran`, not for a binary in `gen-random-cli`. A standalone `genran` package alias must be published separately before that exact invocation can work.


## Usage

Print both values:

```sh
gen-random
```

Print one format only with `--bits`:

```sh
gen-random --bits 128
gen-random --bits 256
```

Override the prefix for one run with `--prefix`:

```sh
gen-random --prefix dev_
gen-random --bits 256 --prefix "service key_"
```

The default prefix is `sk_`. A command-line prefix does not change the saved setting.

Open the interactive settings menu to change the saved prefix:

```sh
gen-random settings
```

Type printable ASCII characters to add to the prefix, use Backspace to remove characters, press Enter to save, or Esc to cancel. Settings are stored in `~/.config/gen-random-cli/settings.json`.

Show all options:

```sh
gen-random --help
```

## Output formats

The total character count includes the prefix. With the default `sk_` prefix, the output is:

```text
128 bits (32 chars): sk_<29 lowercase hex characters>
256 bits (64 chars): sk_<61 lowercase hex characters>
```

The prefix is fixed text and adds no randomness. With `sk_`, the random portions contain 116 and 244 bits respectively. If a custom prefix is too long to fit, the output grows to retain at least 112 random bits for the 128-bit format and 128 random bits for the 256-bit format.

## License

MIT
