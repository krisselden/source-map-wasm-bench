export interface Reader {
  bytes: Uint8Array;
  pos: number;
}

export interface Imports {
  env: {
    emitNewline(): void;
    emitMapping1(column: number): void;
    emitMapping4(column: number, source: number, sourceLine: number, sourceColumn: number): void;
    emitMapping5(column: number, source: number, sourceLine: number, sourceColumn: number, name: number): void;
  }
}

export default function Module(imports: Imports) {
  const { emitMapping1, emitMapping4, emitMapping5, emitNewline } = imports.env;

  const asciiToUint6 = new Uint8Array(127);
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach((char, i) => {
    asciiToUint6[char.charCodeAt(0)] = i;
  });

  function decodeVLQ(reader: Reader) {
    let num = 0;
    let shift = 0;
    let digit = 0;
    let cont = 0;
    let negate = 0;
    do {
      digit  = asciiToUint6[reader.bytes[reader.pos++] & 0x7F];
      cont   = digit & 32;
      digit  = digit & 31;
      if (shift == 0) {
        negate = digit & 1;
        num = digit >> 1;
        shift = 4;
      } else {
        num |= digit << shift;
        shift += 5;
      }
    } while (cont && shift < 30);
    return negate ? -num : num;
  }

  function emitMapping(fieldCount: number, column: number, source: number, sourceLine: number, sourceColumn: number, name: number) {
    switch (fieldCount) {
      case 1:
        emitMapping1(column);
        break;
      case 4:
        emitMapping4(column, source, sourceLine, sourceColumn);
        break;
      case 5:
        emitMapping5(column, source, sourceLine, sourceColumn, name);
        break;
    }
  }

  function decode(reader: Reader) {
    let byte: number;
    let fieldCount = 0;
    let column = 0;
    let source = 0;
    let sourceLine = 0;
    let sourceColumn = 0;
    let name = 0;
    let value = 0;

    while ((byte = reader.bytes[reader.pos]) != 0) {
      switch (byte) {
        case 59: // semicolon
          if (fieldCount > 0) {
            emitMapping(fieldCount, column, source, sourceLine, sourceColumn, name);
          }
          emitNewline();
          column = 0;
          fieldCount = 0;
          reader.pos++;
          break;
        case 44: // comma
          emitMapping(fieldCount, column, source, sourceLine, sourceColumn, name);
          fieldCount = 0;
          reader.pos++;
          break;
        default:
          value = decodeVLQ(reader);
          switch (fieldCount) {
            case 0:
              column += value;
              fieldCount = 1;
              break;
            case 1:
              source += value;
              fieldCount = 2;
              break;
            case 2:
              sourceLine += value;
              fieldCount = 3;
              break;
            case 3:
              sourceColumn += value;
              fieldCount = 4;
              break;
            case 4:
              name += value;
              fieldCount = 5;
              break;
          }
          break;
      }
    }
    if (fieldCount > 0) {
      emitMapping(fieldCount, column, source, sourceLine, sourceColumn, name);
    }
  }

  return { decode };
}
