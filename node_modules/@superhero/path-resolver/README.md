
# Path Resolver

A utility for callbacks to resolved file paths, directories, symbolic links, and Node.js modules, ensuring a consistent path resolution.

## Features

- **File Resolution**: Resolves absolute and relative file paths.
- **Directory Resolution**: Handles absolute and relative directory paths.
- **Symbolic Link Handling**: Resolves symbolic links to their target paths.
- **Module Resolution**: Supports resolving Node.js core modules, installed modules, and scoped packages.
- **Error Handling**: Provides meaningful error messages for invalid paths, non-existent modules, and unsupported path types.

---

## Installation

```bash
npm install @superhero/path-resolver
```

---

## Usage

### Importing the Module
```javascript
import PathResolver from '@superhero/path-resolver'
```

### Resolving Paths

#### Basic Example
```javascript
const pathResolver = new PathResolver()

const resolveFile      = async (filePath) => `Resolved file: ${filePath}`
const resolveDirectory = async (dirPath)  => `Resolved directory: ${dirPath}`

const result = await pathResolver.resolve('./mock/file.js', resolveFile, resolveDirectory)
console.log(result) // Outputs: Resolved file: /absolute/path/to/mock/file.js
```

---

### API

#### **`PathResolver` Class**

#### **`resolve(providedPath, resolveFile, resolveDirectory)`**

- Resolves a given path or module using the provided callbacks.

##### Parameters:
- `providedPath` (string): The path or module name to resolve.
- `resolveFile` (function): Callback for handling file paths. Called with the resolved file path.
- `resolveDirectory` (function): Callback for handling directory paths. Called with the resolved directory path.

##### Returns:
- A promise that resolves to the result of either `resolveFile` or `resolveDirectory`.

##### Throws:
- `E_RESOLVE_PATH`: If the path or module cannot be resolved.

---

### Examples

#### Resolving File Paths
```javascript
const result = await pathResolver.resolve('./file.json', resolveFile, resolveDirectory)
console.log(result) // Resolved file: /absolute/path/to/file.json
```

#### Resolving Directory Paths
```javascript
const result = await pathResolver.resolve('./directory', resolveFile, resolveDirectory)
console.log(result) // Resolved directory: /absolute/path/to/directory
```

#### Handling Symbolic Links
```javascript
const result = await pathResolver.resolve('./symlink', resolveFile, resolveDirectory)
console.log(result) // Resolved directory: /absolute/path/to/real-target
```

#### Resolving Node.js Core Modules
```javascript
const result = await pathResolver.resolve('node:fs', resolveFile, resolveDirectory)
console.log(result) // Resolved file: /absolute/path/to/core/module/fs.js
```

#### Resolving Scoped Packages
```javascript
const result = await pathResolver.resolve('@superhero/path-resolver', resolveFile, resolveDirectory)
console.log(result) // Resolved file: /absolute/path/to/node_modules/@superhero/path-resolver/index.js
```

#### Handling Invalid Paths
```javascript
try
{
  await pathResolver.resolve('./non-existent-path', resolveFile, resolveDirectory)
} 
catch(error) 
{
  console.error(error.code) // E_RESOLVE_PATH
}
```

---

### Tests

This module includes a test suite. To run the tests:

```bash
npm test
```

### Test Coverage

```
▶ @superhero/path-resolver
  ✔ Resolves file paths correctly (4.152623ms)
  ✔ Resolves directory paths correctly (1.573636ms)
  ✔ Handles symbolic links correctly (1.284275ms)
  ✔ Throws error for invalid symbolic link (1.924598ms)
  ✔ Throws error for invalid path (2.207014ms)
  ✔ Resolves paths to Node.js core modules (0.488862ms)
  ✔ Resolves paths to "@superhero/path-resolver" module (1.268896ms)
  ✔ Throws error for non-existent module (0.805901ms)
  ✔ Can use relative paths relative to the main directory (1.407842ms)
  ✔ Can alter basePath to determine the root to a relative path (0.668805ms)
  ✔ Can use parent directory in a relative path (0.571907ms)
  ✔ Throws error if not using a string as provided path to resolve (0.266317ms)
✔ @superhero/path-resolver (30.570623ms)

tests 12
pass 12

----------------------------------------------------------------
file            | line % | branch % | funcs % | uncovered lines
----------------------------------------------------------------
index.js        |  96.08 |    95.65 |  100.00 | 97-100
index.test.js   | 100.00 |   100.00 |   96.97 | 
----------------------------------------------------------------
all files       |  98.49 |    98.21 |   97.44 | 
----------------------------------------------------------------
```

---

### Error Codes

- **`E_RESOLVE_PATH`**:
  - Thrown when the provided path or module cannot be resolved.

---

### License

This project is licensed under the [MIT License](LICENSE).

---

## Contributing
Feel free to submit issues or pull requests for improvements or additional features.
