import assert       from 'assert'
import PathResolver from '@superhero/path-resolver'
import fs           from 'node:fs/promises'
import path         from 'node:path'
import url          from 'node:url'
import { before, beforeEach, after, suite, test } from 'node:test'

suite('@superhero/path-resolver', () =>
{
  const 
    noop                = () => null,
    mockDir             = './test',
    mockFile            = `${mockDir}/mock-file`,
    mockSubDir          = `${mockDir}/mock-sub-dir`,
    mockSymlink         = `${mockDir}/mock-symlink`,
    mockInvalidSymlink  = `${mockDir}/invalid-symlink`

  let pathResolver

  before(async () =>
  {
    await fs.mkdir(mockDir, { recursive: true })

    // Create mocked files and directories
    await fs.writeFile(mockFile, 'mocked file for testing purpose')
    await fs.mkdir(mockSubDir, { recursive: true })

    // Create mocked symbolic link
    await fs.symlink('mock-sub-dir', mockSymlink)
    await fs.symlink('non-existent-target', mockInvalidSymlink)

  })

  beforeEach(() =>
  {
    pathResolver = new PathResolver()
    assert.ok(pathResolver instanceof PathResolver, 'Should initialize PathResolver correctly')
  })

  after(async () =>
  {
    await fs.rm(mockDir, { recursive: true, force: true })
  })

  test('Resolves file paths correctly', async () =>
  {
    const
      resolveFile       = async (filePath) => filePath,
      absoluteFilePath  = path.resolve(mockFile),
      result            = await pathResolver.resolve(absoluteFilePath, resolveFile, noop)

    assert.strictEqual(result, absoluteFilePath, 'Should resolve file path correctly')
  })

  test('Resolves directory paths correctly', async () =>
  {
    const
      resolveDirectory  = async (dirPath) => dirPath,
      absoluteSubDir    = path.resolve(mockSubDir),
      result            = await pathResolver.resolve(absoluteSubDir, noop, resolveDirectory)

    assert.strictEqual(result, absoluteSubDir, 'Should resolve directory path correctly')
  })

  test('Handles symbolic links correctly', async () =>
  {
    const
      resolveDirectory    = async (dirPath) => dirPath,
      absoluteSymlinkPath = path.resolve(mockSymlink),
      realDirPath         = await fs.realpath(absoluteSymlinkPath),
      result              = await pathResolver.resolve(absoluteSymlinkPath, noop, resolveDirectory)
  
    assert.strictEqual(result, realDirPath, 'Should resolve symbolic link correctly')
  })
  
  test('Throws error for invalid symbolic link', async () =>
  {
    await assert.rejects(
      async () => pathResolver.resolve(path.resolve(mockInvalidSymlink), noop, noop),
      (error) => error.code === 'E_RESOLVE_PATH' && error.cause.code === 'ENOENT',
      'Should throw error for invalid symbolic link')
  })

  test('Throws error for invalid path', async () =>
  {
    const
      absoluteMockDir = path.resolve(mockDir),
      invalidPath     = `${absoluteMockDir}/invalid-path`

    await assert.rejects(
      async () => pathResolver.resolve(invalidPath, noop, noop),
      (error) => error.code === 'E_RESOLVE_PATH' && error.cause.code === 'ENOENT',
      'Should throw error for invalid path')
  })

  test('Resolves paths to Node.js core modules', async () =>
  {
    const
      resolveFile = async (filePath) => filePath,
      result      = await pathResolver.resolve('node:fs', resolveFile, noop)

    assert.notEqual(result, null, 'Should resolve Node.js core module correctly')
  })

  test('Resolves paths to "@superhero/path-resolver" module', async () =>
  {
    const
      resolveFile = async (filePath) => filePath,
      result      = await pathResolver.resolve('@superhero/path-resolver', resolveFile, noop)

    assert.notEqual(result, null, 'Should resolve Node.js core module correctly')
  })

  test('Throws error for non-existent module', async () =>
  {
    await assert.rejects(
      async () => pathResolver.resolve('non-existent-module', noop, noop),
      (error) => error.code === 'E_RESOLVE_PATH' && error.cause.code === 'MODULE_NOT_FOUND',
      'Should throw error for non-existent module')
  })

  test('Can use relative paths relative to the main directory', async () =>
  {
    const
      resolveFile       = async (filePath) => filePath,
      result            = await pathResolver.resolve(mockFile, resolveFile, noop),
      absoluteFilePath  = path.resolve(mockFile)

    assert.strictEqual(result, absoluteFilePath, 'Should resolve file path correctly')
  })

  test('Can alter basePath to determine the root to a relative path', async () =>
  {
    pathResolver.basePath = path.join(pathResolver.basePath, mockDir)

    const
      resolveFile       = async (filePath) => filePath,
      absoluteFilePath  = path.resolve(mockFile),
      result            = await pathResolver.resolve('./mock-file', resolveFile, noop)

    assert.strictEqual(result, absoluteFilePath, 'Should resolve file path correctly')
  })

  test('Can use parent directory in a relative path', async () =>
  {
    pathResolver.basePath = path.join(pathResolver.basePath, mockDir, './sub-dir')

    const
      resolveFile       = async (filePath) => filePath,
      absoluteFilePath  = path.resolve(mockFile),
      result            = await pathResolver.resolve('../mock-file', resolveFile, noop)

    assert.strictEqual(result, absoluteFilePath, 'Should resolve file path correctly')
  })

  test('Throws error if not using a string as provided path to resolve', async () =>
  {
    await assert.rejects(
      async () => pathResolver.resolve(null, noop, noop),
      (error) => error.code === 'E_RESOLVE_PATH' && error.cause.code === 'E_RESOLVE_PATH_INVALID_PROVIDED_PATH_TYPE',
      'Should throw error for invalid provided path type')
  })
})
