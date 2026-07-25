import { promises as fs } from 'fs'
import path from 'path'
import { screen, app } from 'electron'
import { isPoeItemText } from '../shortcuts/HostClipboard'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import type { OverlayWindow } from '../windowing/OverlayWindow'

const POLL_INTERVAL = 500
const WATCH_EXTENSION = '.txt'

// This feature currently targets Windows only, matching the requested
// default folder. Add other platform paths here if support is needed.
const DEFAULT_FOLDER = (process.platform === 'win32')
  ? 'Z:\\SharedWith Windows 10 4\\POE Data\\'
  : null

// Watches a folder for new .txt files instead of listening for a
// keyboard shortcut. We deliberately avoid fs.watch/watchFile (those
// use OS-level file change notification APIs) and just re-list the
// directory on a timer, per requirements.
export class ItemFileWatcher {
  private timerId: NodeJS.Timeout | undefined
  private knownFiles = new Set<string>()
  private folderPath: string | null = null
  private isPolling = false

  private cfgPath = path.join(app.getPath('userData'), 'apt-data', 'config.json')

  constructor (
    private server: ServerEvents,
    private logger: Logger,
    private overlay: OverlayWindow
  ) {}

  // Starts polling folderPath (or the platform default) every
  // POLL_INTERVAL ms. Calling this again with the same path is a no-op;
  // calling it with a different path restarts the watcher.
  async start (folderPath: string = DEFAULT_FOLDER ?? '') {
    if (this.folderPath === folderPath) return
    this.stop()

    this.logger.write('[ItemFileWatcher] starting.')
    this.logger.write(`[ItemFileWatcher] cfgPath if ${this.cfgPath}.`)
    
    if (!folderPath) {
      this.logger.write('error [ItemFileWatcher] No folder is configured for this platform.')
      return
    }

    try {
      await fs.mkdir(folderPath, { recursive: true })
    } catch {
      this.logger.write(`error [ItemFileWatcher] Failed to create or access folder "${folderPath}".`)
      return
    }

    this.folderPath = folderPath
    this.logger.write(`[ItemFileWatcher] starting. Monitoring ${folderPath}`)

    // Seed known files so anything already sitting in the folder at
    // startup is ignored instead of being treated as a new drop.
    try {
      this.knownFiles = new Set(await fs.readdir(folderPath))
    } catch {
      this.logger.write(`error [ItemFileWatcher] this.knownFiles init failed`)
      this.knownFiles = new Set()
    }

    this.timerId = setInterval(() => { this.poll() }, POLL_INTERVAL)
    this.logger.write(`[ItemFileWatcher] timer started`)
  }

  stop () {
    if (this.timerId !== undefined) {
      clearInterval(this.timerId)
      this.timerId = undefined
      this.logger.write(`[ItemFileWatcher] timer stopped`)
    }
    this.folderPath = null
    this.knownFiles.clear()
  }

  private async poll () {
    if (this.isPolling || !this.folderPath) return
    this.isPolling = true

    try {
      const entries = await fs.readdir(this.folderPath)
      const currentFiles = new Set(entries)

      for (const fileName of entries) {
        if (this.knownFiles.has(fileName)) continue
        if (path.extname(fileName).toLowerCase() !== WATCH_EXTENSION) {
            this.logger.write(`[ItemFileWatcher] ignore file ${fileName}`)
            continue
        } 

        // Not added to knownFiles here on purpose: if reading fails
        // (e.g. the file is still being written by another process)
        // it gets retried on the next poll.
        await this.handleNewFile(fileName)
      }

      this.knownFiles = currentFiles
    } catch {
      // Folder may be temporarily missing/inaccessible; retry next poll
      // instead of stopping the watcher.
    } finally {
      this.isPolling = false
    }
  }

  private async handleNewFile (fileName: string) {
    const filePath = path.join(this.folderPath!, fileName)
    this.logger.write(`[ItemFileWatcher] process file ${filePath}`)

    let contents: string
    try {
      contents = await fs.readFile(filePath, 'utf-8')
    } catch {
      this.logger.write(`error [ItemFileWatcher] file read failed`)
      return
    }

    // The file has been read; remove it so it is not processed again
    // and the folder does not fill up with old drops.
    try {
      await fs.unlink(filePath)
    } catch {
      this.logger.write(`error [ItemFileWatcher] Failed to remove processed file "${fileName}".`)
    }

    if (!isPoeItemText(contents)) {
      this.logger.write(`[ItemFileWatcher] input error: not recognized format`)
      return
    }

    this.logger.write(`[ItemFileWatcher] Sending message last-active/item-text/price-check`)
    this.logger.write(`[ItemFileWatcher] Sending message with content: ${contents}`)

// This is what I see in C:\src\awakened-poe-trade\renderer\src\web\item-check\hotkeyable-actions.ts
//     if (!['open-wiki', 'open-craft-of-exile', 'open-poedb', 'search-similar'].includes(e.target)) return

// server.sendEventTo first parameter: 'last-active' | 'any' | 'broadcast',
//        target: 'search-similar',

    this.server.sendEventTo('last-active', {
      name: 'MAIN->CLIENT::item-text',
      payload: {
        target: 'price-check',
        clipboard: contents,
        position: screen.getCursorScreenPoint(),
        focusOverlay: true
      }
    })
this.logger.write(`[ItemFileWatcher] Sent`)
      this.overlay.assertOverlayActive()
this.logger.write(`[ItemFileWatcher] assertOverlayActive`)

    // if (this.overlay.wasUsedRecently) {
    //   this.overlay.assertOverlayActive()
    // }
  }
}
