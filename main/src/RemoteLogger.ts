import type { ServerEvents } from './server'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export class Logger {
  history = ''

  // Append-mode stream to the local log file. Opened once and kept open
  // for the lifetime of the app instead of reopening the file on every
  // write() call. Lives directly in apt-data so it is visible via the
  // existing "Open config folder" tray menu item, next to config.json.
  private fileStream: fs.WriteStream | null = null

  constructor (
    private server: ServerEvents
  ) {
    this.fileStream = this.createFileStream()
  }

  private createFileStream (): fs.WriteStream | null {
    const dataDir = path.join(app.getPath('userData'), 'apt-data')

    try {
      // Directory may not exist yet on first run.
      fs.mkdirSync(dataDir, { recursive: true })
    } catch {
      // If we cannot create/access apt-data, disable file logging but
      // let the rest of the app continue working normally.
      return null
    }

    const logFilePath = path.join(dataDir, 'app.log')
    const stream = fs.createWriteStream(logFilePath, { flags: 'a' })

    // Writing to disk can fail at any point (disk full, permissions
    // revoked, etc). Swallow the error here so a logging failure never
    // crashes the app; log delivery to the renderer still works.
    stream.on('error', () => {
      this.fileStream = null
    })

    return stream
  }

  write (message: string) {
    message = `[${new Date().toLocaleTimeString()}] ${message}\n`
    this.history += message
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::log-entry',
      payload: { message }
    })

    this.fileStream?.write(message)
  }
}