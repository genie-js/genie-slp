import Struct, { types as t } from 'awestruct'

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

// SLP Header
let headerStruct = Struct({
  version: t.string(4)
, numFrames: t.int32
, comment: t.string(24)

, frames: t.array('numFrames', Struct({
    cmdTableOffset: t.uint32
  , outlineTableOffset: t.uint32
  , paletteOffset: t.uint32
  , properties: t.uint32

  , width: t.int32
  , height: t.int32
  , hotspot: Struct({
      x: t.int32
    , y: t.int32
    })
  }))
})

let getPlayerColor = (pal, idx, player) => pal[idx + 16 * player]

/**
 * @param {Buffer} buf
 */
export default function SLP(buf) {
  if (!(this instanceof SLP)) return new SLP(buf)

  this.frames = []
  this.bodyOffset = 0
  this.buf = buf
  this.parseHeader()
}

/**
 * Parses the .SLP header.
 */
SLP.prototype.parseHeader = function () {
  var offset = 0
    , frame
    , buf = this.buf

  var header = headerStruct(buf)
  this.version = header.version
  this.numFrames = header.numFrames
  this.comment = header.comment
  this.frames = header.frames

  this.bodyOffset = /* header */ 32 + /* frames */ 32 * header.numFrames
}

/**
 * Parses a frame.
 * @param {number} id Frame ID.
 * @return {Object} Frame with added `.outlines` and `.commands` properties.
 */
SLP.prototype.parseFrame = function (id) {
  var frame = this.frames[id]
    , offset = frame.outlineTableOffset
    , height = frame.height
    , buf = this.buf
    , outlines = []

  let orNext = x => x ? x : buf[++offset]

  for (let i = 0; i < height; i++) {
    let left = buf.readUInt16LE(offset)
    let right = buf.readUInt16LE(offset + 2)
    outlines.push({ left, right })
    offset += 4
  }

  offset = frame.cmdTableOffset + frame.height * 4
  var y = 0
    , commands = []
    , pxCount

  while (y < height) {
    let cmd = buf[offset]
    let lowNibble = cmd & 0x0f
    let highNibble = cmd & 0xf0
    let lowBits = cmd & 0x03 // 0b00…0011

    if (lowNibble === SLP_END_OF_ROW) {
      commands.push({ command: RENDER_NEXTLINE })
      y++
    }
    else if (lowBits === SLP_COLOR_LIST) {
      pxCount = cmd >> 2
      while (pxCount--) {
        offset++
        commands.push({ command: RENDER_COLOR, arg: /* color */ buf[offset] })
      }
    }
    else if (lowBits === SLP_SKIP) {
      pxCount = orNext(cmd >> 2)
      commands.push({ command: RENDER_SKIP, arg: pxCount })
    }
    else if (lowNibble === SLP_COLOR_LIST_EX) {
      offset++
      pxCount = (highNibble << 4) + buf[offset]
      while (pxCount--) {
        offset++
        commands.push({ command: RENDER_COLOR, arg: /* color */ buf[offset] })
      }
    }
    else if (lowNibble === SLP_SKIP_EX) {
      offset++
      pxCount = (highNibble << 4) + buf[offset]
      commands.push({ command: RENDER_SKIP, arg: pxCount })
    }
    else if (lowNibble === SLP_COLOR_LIST_PLAYER) {
      pxCount = orNext(cmd >> 4)
      while (pxCount--) {
        offset++
        commands.push({ command: RENDER_PLAYER_COLOR, arg: buf[offset] })
      }
    }
    else if (lowNibble === SLP_FILL) {
      pxCount = orNext(cmd >> 4)
      offset++
      commands.push({ command: RENDER_FILL, arg: { pxCount: pxCount, color: buf[offset] } })
    }
    else if (lowNibble === SLP_FILL_PLAYER) {
      pxCount = orNext(cmd >> 4)
      offset++
      commands.push({ command: RENDER_PLAYER_FILL, arg: { pxCount: pxCount, color: buf[offset] } })
    }
    else if (lowNibble === SLP_SHADOW) {
      pxCount = orNext(cmd >> 4)
      commands.push({ command: RENDER_SHADOW, arg: pxCount })
    }
    else if (lowNibble === SLP_EXTENDED) {
      if (highNibble === SLP_EX_OUTLINE1) {
        commands.push({ command: RENDER_OUTLINE, arg: 1 })
      }
      else if (highNibble === SLP_EX_OUTLINE2) {
        commands.push({ command: RENDER_OUTLINE, arg: 2 })
      }
      else if (highNibble === SLP_EX_FILL_OUTLINE1) {
        offset++
        pxCount = buf[offset]
        while (pxCount--) {
          commands.push({ command: RENDER_OUTLINE, arg: 1 })
        }
      }
      else if (highNibble === SLP_EX_FILL_OUTLINE2) {
        offset++
        pxCount = buf[offset]
        while (pxCount--) {
          commands.push({ command: RENDER_OUTLINE, arg: 2 })
        }
      }
    }
    else {
      throw new Error('unrecognized opcode 0x' + cmd.toString(16))
    }
    offset++
  }

  frame.outlines = outlines
  frame.commands = commands
  return frame
}

/**
 * Get a parsed frame.
 * @param {number} id Frame ID.
 * @return {Object} Parsed frame object.
 */
SLP.prototype.getFrame = function (id) {
  if (!this.frames[id] || !this.frames[id].commands) {
    this.parseFrame(id)
  }
  return this.frames[id]
}

/**
 * Renders a frame to a buffer.
 * @param {number} frameIdx Frame ID.
 * @param {number} player Player colour (1-8) to use for player-specific parts. Defaults to 1 (blue).
 * @param {PaletteFile} palette A Palette file that contains the colours for this SLP.
 * @param {boolean} drawOutline Whether to draw an outline (used when units are behind buildings, etc). Defaults to false.
 * @return {Object} Object containing Buffer of r,g,b,a values.
 */
SLP.prototype.renderFrame = function (frameIdx, palette, { player, drawOutline } = {}) {
  if (!palette) throw new Error('no palette passed to renderFrame')
  if (!player) player = 1

  let frame = this.getFrame(frameIdx)
  let outlines = frame.outlines
  let pixels = Buffer(frame.width * frame.height * 4)
  let idx = 0
  let y = 0

  let pushColor = (col, opac) => {
    pixels[idx++] = col[0]
    pixels[idx++] = col[1]
    pixels[idx++] = col[2]
    pixels[idx++] = opac
  }

  let skip = outlines[0].left
  if (skip === SLP_LINE_EMPTY) {
    skip = frame.width
  }
  pixels.fill(255, 0, skip * 4)
  idx = skip * 4

  frame.commands.forEach(({ command, arg }) => {
    switch (command) {
    case RENDER_SKIP:
      pixels.fill(255, idx, idx + arg * 4)
      idx += arg * 4
      break
    case RENDER_NEXTLINE:
      // fill up the rest of this line
      pixels.fill(255, idx, idx + outlines[y].right * 4)
      idx += outlines[y].right * 4
      y++
      if (y < frame.height) {
        // transparent lines are stored as a negative outline
        let skip = outlines[y].left
        if (skip === SLP_LINE_EMPTY) {
          skip = frame.width
        }
        // fill the start of this line until the first pixel
        pixels.fill(255, idx, idx + skip * 4)
        idx += skip * 4
      }
      break
    case RENDER_COLOR:
      pushColor(palette[arg], 0)
      break
    case RENDER_FILL:
      let i = arg.pxCount
      let color = palette[arg.color]
      while (i--) pushColor(color, 0)
      break
    case RENDER_OUTLINE:
      pushColor([ 0, 0, 0 ], drawOutline ? 0 : 255)
      break
    case RENDER_PLAYER_COLOR:
      pushColor(getPlayerColor(palette, arg, player), 0)
      break
    case RENDER_PLAYER_FILL:
      let i = arg.pxCount
      let color = getPlayerColor(palette, arg.color, player)
      while (i--) pushColor(color, 0)
      break
    case RENDER_SHADOW:
      let i = arg
      while (i--) pushColor([ 255, 0, 0 ], 0)
      break
    }
  })

  return { buffer: pixels, width: frame.width, height: frame.height }
}