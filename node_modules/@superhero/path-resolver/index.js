import fs     from 'node:fs/promises'
import module from 'node:module'
import path   from 'node:path'

const require = module.createRequire(import.meta.url)

export default class PathResolver
{
  /**
   * @type {string|undefined}
   */
  #basePath = path.dirname(process.argv[1])

  set basePath(value)
  {
    this.#basePath = value
  }

  get basePath()
  {
    return this.#basePath
  }

  /**
   * @param {string}    providedPath 
   * @param {function}  resolveFile callback
   * @param {function}  resolveDirectory callback
   */
  async resolve(providedPath, resolveFile, resolveDirectory)
  {
    try
    {
      const normalizedPath = this.#normalizePath(providedPath)

      if(path.isAbsolute(normalizedPath))
      {
        return await this.#resolveProvidedPath(normalizedPath, resolveFile, resolveDirectory)
      }
      else
      {
        const resolvedFilePath = require.resolve(providedPath)
        return await resolveFile(resolvedFilePath)
      }
    }
    catch(reason)
    {
      const error = new Error(`Could not resolve path "${providedPath}"`)
      error.code  = 'E_RESOLVE_PATH'
      error.cause = reason
      throw error
    }
  }

  #normalizePath(providedPath)
  {
    if('string' !== typeof providedPath)
    {
      const error = new TypeError('Provided path must be a string')
      error.code  = 'E_RESOLVE_PATH_INVALID_PROVIDED_PATH_TYPE'
      error.cause = new TypeError(`Invalid provided path type "${Object.prototype.toString.call(providedPath)}"`)
      throw error
    }

    if('string' === typeof this.basePath)
    {
      if(providedPath[0] === '.'
      &&(providedPath[1] === path.sep
      ||(providedPath[1] === '.'
      && providedPath[2] === path.sep)))
      {
        providedPath = path.join(this.basePath, providedPath)
      }
    }

    return providedPath
  }

  async #resolveProvidedPath(providedPath, resolveFile, resolveDirectory)
  {
    const stats = await fs.lstat(providedPath)

    if(stats.isSymbolicLink())
    {
      const symbolicLinkPath = await fs.realpath(providedPath)
      return await this.#resolveProvidedPath(symbolicLinkPath, resolveFile, resolveDirectory)
    }

    if(stats.isFile())
    {
      return await resolveFile(providedPath)
    }

    if(stats.isDirectory()) 
    {
      return await resolveDirectory(providedPath)
    }

    const error = new TypeError('Unknown path type')
    error.code  = 'E_RESOLVE_PATH_UNKNOWN_TYPE'
    throw error
  }
}