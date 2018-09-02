const Palette = require('jascpal')
const headerStruct = require('./header')

module.exports = SLPEncoder

// SLP commands
const SLP_END_OF_ROW = 0x0f
const SLP_COLOR_LIST = 0x00
const SLP_COLOR_LIST_EX = 0x02
const SLP_COLOR_LIST_PLAYER = 0x06
const SLP_SKIP = 0x01
const SLP_SKIP_EX = 0x03
const SLP_FILL = 0x07
const SLP_FILL_PLAYER = 0x0a
const SLP_SHADOW = 0x0b
const SLP_EXTENDED = 0x0e
const SLP_EX_OUTLINE1 = 0x40
const SLP_EX_FILL_OUTLINE1 = 0x50
const SLP_EX_OUTLINE2 = 0x60
const SLP_EX_FILL_OUTLINE2 = 0x70
const SLP_LINE_EMPTY = 0x8000

// Render commands
const RENDER_NEXTLINE = 0x00
const RENDER_COLOR = 0x01
const RENDER_SKIP = 0x02
const RENDER_PLAYER_COLOR = 0x03
const RENDER_SHADOW = 0x04
const RENDER_OUTLINE = 0x05
const RENDER_FILL = 0x06
const RENDER_PLAYER_FILL = 0x07

function last (arr) {
  return arr[arr.length - 1]
}

function padSlice (str, len, padding = '\0') {
  str = str.slice(0, len)
  while (str.length < len) str += padding
  return str
}

function detectPalette (data, options = {}) {
  const mainColors = Object.create(null)
  for (let i = 0; i < data.length; i += 4) {
    const idx = String((data[i] << 16) + (data[i + 1] << 8) + data[i + 2])
    if (!mainColors[idx]) mainColors[idx] = data.slice(0, 3)
  }

  const palette = Object.keys(mainColors).map((x) => mainColors[x])

  // Pad.
  while (palette.length < 256) {
    palette.push([ 0, 0, 0 ])
  }

  return Palette(palette)
}

function SLPEncoder (options = {}) {
  if (!(this instanceof SLPEncoder)) return new SLPEncoder(options)

  if (!options.palette) {
    throw new Error('SLPEncoder: `palette` option is required')
  }

  this.version = options.version || '1.00'
  this.comment = options.comment || ''
  this.palette = options.palette
  this.frames = []

  this.colorIndices = {}
  for (let i = 0; i < this.palette.length; i++) {
    const [r, g, b] = this.palette[i]
    const c = (r << 16) + (g << 8) + b
    this.colorIndices[c] = i
  }
}

SLPEncoder.detectPalette = detectPalette

function pixelsToRenderCommands (palette, { width, height, data }) {
  const commands = []

  let prevCommand
  let prevArg
  function push (command, arg) {
    prevCommand = command
    prevArg = arg
    commands.push({ command, arg })
  }

  for (let i = 0; i < data.length; i += 4) {
    if (i > 0 && (i / 4) % width === 0) {
      push(RENDER_NEXTLINE)
    }
    // transparent pixel
    if (data[i + 3] === 0) {
      if (prevCommand === RENDER_SKIP) {
        last(commands).arg++
      } else {
        push(RENDER_SKIP, 1)
      }
      continue
    }

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const c = (r << 16) + (g << 8) + b
    const index = palette[c]
    if (!index) {
      throw new Error(`Missing color: [${r} ${g} ${b}] is not in palette`)
    }
    if (prevCommand === RENDER_FILL && index === prevArg.color) {
      prevArg.pxCount++
    } else if (prevCommand === RENDER_COLOR && index === prevArg) {
      commands.pop()
      push(RENDER_FILL, {
        pxCount: 2,
        color: index
      })
    } else {
      push(RENDER_COLOR, index)
    }
  }

  return commands
}

function renderCommandsToSlpFrame ({ width, height, commands, baseOffset }) {
  const buffer = Buffer.alloc(
    (height * 4) + // outlines
    (height * 4) + // cmd table offsets
    // space for cmd table. each render command takes at most 2 bytes
    (commands.length * 2)
  )
  const outlines = [
    { left: 0, right: 0 }
  ]
  let offset = (height * 4) + (height * 4)
  const offsets = [
    offset
  ]


  let x = 0
  let y = 0
  for (let i = 0; i < commands.length; i++) {
    const { command, arg } = commands[i]
    if (command === RENDER_NEXTLINE) {
      buffer[offset++] = SLP_END_OF_ROW
      offsets.push(offset)
      y++
      x = 0
      outlines[y] = { left: 0, right: 0 }
    } else if (command === RENDER_COLOR) {
      let end = i
      while (commands[end].command === RENDER_COLOR) {
        end++
      }
      buffer[offset++] = SLP_COLOR_LIST | ((end - i) << 2)
      for (; i < end; i++) {
        buffer[offset++] = commands[i].arg
        x++
      }
      i--
    } else if (command === RENDER_FILL) {
      if (arg.pxCount < 16) {
        buffer[offset++] = SLP_FILL | (arg.pxCount << 4)
      } else {
        buffer[offset++] = SLP_FILL
        buffer[offset++] = arg.pxCount
      }
      buffer[offset++] = arg.color
      x += arg.pxCount
    } else if (command === RENDER_SKIP) {
      if (x === 0) {
        if (arg === width) {
          outlines[y].left = SLP_LINE_EMPTY
        } else {
          outlines[y].left = arg
        }
      } else if (x + arg === width) {
        outlines[y].right = arg
      } else if (arg >= 64) {
        buffer[offset++] = SLP_SKIP
        buffer[offset++] = arg
      } else {
        buffer[offset++] = SLP_SKIP | (arg << 2)
      }
      x += arg
    }
  }

  buffer[offset++] = SLP_END_OF_ROW

  // Flush outlines
  for (let i = 0; i < outlines.length; i++) {
    buffer.writeUInt16LE(outlines[i].left, i * 4)
    buffer.writeUInt16LE(outlines[i].right, i * 4 + 2)
  }
  for (let i = 0; i < offsets.length; i++) {
    buffer.writeUInt32LE(baseOffset + offsets[i], (height * 4) + (i * 4))
  }

  return buffer.slice(0, offset)
}

SLPEncoder.prototype.addFrame = function ({
  width,
  height,
  data,
  hotspot = { x: 0, y: 0 }
}) {
  const commands = pixelsToRenderCommands(this.colorIndices, { width, height, data })

  this.frames.push({
    cmdTableOffset: 0,
    outlineTableOffset: 0,
    paletteOffset: 0,
    properties: 0,
    width,
    height,
    hotspot,
    data,
    commands
  })

  return commands
}

SLPEncoder.prototype.encode = function () {
  const header = {
    version: padSlice(this.version, 4),
    numFrames: this.frames.length,
    comment: padSlice(this.comment, 24),
    frames: this.frames
  }

  let offset = headerStruct.encodingLength(header)
  const frameBuffers = this.frames.map((frame) => {
    frame.outlineTableOffset = offset
    frame.cmdTableOffset = offset + frame.height * 4
    const buffer = renderCommandsToSlpFrame({
      width: frame.width,
      height: frame.height,
      commands: frame.commands,
      baseOffset: offset
    })
    offset += buffer.length
    return buffer
  })

  return Buffer.concat([
    headerStruct.encode(header),
    ...frameBuffers
  ])
}
