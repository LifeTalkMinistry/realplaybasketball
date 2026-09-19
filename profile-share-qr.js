(() => {
  if (window.RealPlayProfileQr) return;

  const VERSION = 4;
  const SIZE = 17 + VERSION * 4;
  const DATA_CODEWORDS = 80;
  const ECC_CODEWORDS = 20;
  const ALIGNMENT = [6, 26];

  function multiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i -= 1) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xff;
  }

  function divisor(degree) {
    const result = new Uint8Array(degree);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i += 1) {
      for (let j = 0; j < degree; j += 1) {
        result[j] = multiply(result[j], root);
        if (j + 1 < degree) result[j] ^= result[j + 1];
      }
      root = multiply(root, 0x02);
    }
    return result;
  }

  const RS_DIVISOR = divisor(ECC_CODEWORDS);

  function remainder(data) {
    const result = new Uint8Array(ECC_CODEWORDS);
    for (const byte of data) {
      const factor = byte ^ result[0];
      result.copyWithin(0, 1);
      result[ECC_CODEWORDS - 1] = 0;
      for (let i = 0; i < ECC_CODEWORDS; i += 1) {
        result[i] ^= multiply(RS_DIVISOR[i], factor);
      }
    }
    return result;
  }

  function appendBits(bits, value, length) {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  }

  function encodeData(text) {
    const bytes = new TextEncoder().encode(String(text || ''));
    if (!bytes.length || bytes.length > 78) throw new Error('Profile URL is too long for the local QR encoder.');

    const bits = [];
    appendBits(bits, 0x4, 4);
    appendBits(bits, bytes.length, 8);
    for (const byte of bytes) appendBits(bits, byte, 8);

    const capacityBits = DATA_CODEWORDS * 8;
    for (let i = 0; i < 4 && bits.length < capacityBits; i += 1) bits.push(0);
    while (bits.length % 8) bits.push(0);

    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let value = 0;
      for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
      data.push(value);
    }
    let pad = true;
    while (data.length < DATA_CODEWORDS) {
      data.push(pad ? 0xec : 0x11);
      pad = !pad;
    }
    if (data.length !== DATA_CODEWORDS) throw new Error('Profile URL exceeds QR capacity.');

    const ecc = remainder(Uint8Array.from(data));
    return Uint8Array.from([...data, ...ecc]);
  }

  function makeMatrix(text) {
    const codewords = encodeData(text);
    const modules = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    const isFunction = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

    function setFunction(x, y, dark) {
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
      modules[y][x] = Boolean(dark);
      isFunction[y][x] = true;
    }

    function drawFinder(cx, cy) {
      for (let dy = -4; dy <= 4; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) {
            setFunction(x, y, dist !== 2 && dist <= 3);
          }
        }
      }
    }

    drawFinder(3, 3);
    drawFinder(SIZE - 4, 3);
    drawFinder(3, SIZE - 4);

    for (let i = 0; i < SIZE; i += 1) {
      if (!isFunction[6][i]) setFunction(i, 6, i % 2 === 0);
      if (!isFunction[i][6]) setFunction(6, i, i % 2 === 0);
    }

    for (const y of ALIGNMENT) {
      for (const x of ALIGNMENT) {
        if (isFunction[y][x]) continue;
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            setFunction(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }

    for (let i = 0; i <= 5; i += 1) setFunction(8, i, false);
    setFunction(8, 7, false);
    setFunction(8, 8, false);
    setFunction(7, 8, false);
    for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, false);
    for (let i = 0; i < 8; i += 1) setFunction(SIZE - 1 - i, 8, false);
    for (let i = 8; i < 15; i += 1) setFunction(8, SIZE - 15 + i, false);
    setFunction(8, SIZE - 8, true);

    let bitIndex = 0;
    let upward = true;
    for (let right = SIZE - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < SIZE; vert += 1) {
        const y = upward ? SIZE - 1 - vert : vert;
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          if (isFunction[y][x]) continue;
          const dataBit = bitIndex < codewords.length * 8
            ? ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0
            : false;
          const mask = (x + y) % 2 === 0;
          modules[y][x] = dataBit !== mask;
          bitIndex += 1;
        }
      }
      upward = !upward;
    }

    const formatData = 0x08;
    let rem = formatData;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const formatBits = ((formatData << 10) | rem) ^ 0x5412;
    const bit = (i) => ((formatBits >>> i) & 1) !== 0;

    for (let i = 0; i <= 5; i += 1) setFunction(8, i, bit(i));
    setFunction(8, 7, bit(6));
    setFunction(8, 8, bit(7));
    setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i += 1) setFunction(SIZE - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i += 1) setFunction(8, SIZE - 15 + i, bit(i));
    setFunction(8, SIZE - 8, true);

    return modules;
  }

  function draw(canvas, text, options = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('QR canvas is unavailable.');
    const modules = makeMatrix(text);
    const quiet = Math.max(4, Number(options.quietZoneModules) || 4);
    const requested = Math.max(96, Math.round(Number(options.size) || 160));
    const moduleCount = SIZE + quiet * 2;
    const scale = Math.max(1, Math.floor(requested / moduleCount));
    const actual = moduleCount * scale;
    canvas.width = actual;
    canvas.height = actual;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, actual, actual);
    ctx.fillStyle = '#000';
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (modules[y][x]) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
      }
    }
    return canvas;
  }

  window.RealPlayProfileQr = Object.freeze({ draw, makeMatrix });
})();
