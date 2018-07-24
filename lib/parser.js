
'use strict';

const PROTOCOL_VERSION = 1;
const HANDSHAKE_LENGTH = 36;
const PARCEL_LENGTH = 16;
const CHUNK_LENGTH = 12;

const PARCEL_TYPES = {
  PARCEL_PING: 0,
  PARCEL_PONG: 1,
  PARCEL_CALL: 2,
  PARCEL_CALLBACK: 3,
  PARCEL_EVENT: 4,
  PARCEL_STREAM: 5
};

const constObj = Object.assign({
  PROTOCOL_VERSION,
  HANDSHAKE_LENGTH,
  PARCEL_LENGTH,
  CHUNK_LENGTH,
  STRUCT_PARCEL: 0,
  STRUCT_CHUNK: 1,
}, PARCEL_TYPES);

const readParcel = (buffer, length) => {
  // Read parcel from buffer
  // Return parcel object
  const parcel = { structType: constObj.STRUCT_PARCEL };
  parcel.parcelId = buffer.readInt32LE(1);
  parcel.parcelType = buffer.readInt8(5);
  parcel.compression = buffer.readInt8(6);
  parcel.encoding = buffer.readInt8(7);
  const parcelLength = buffer.slice(8, length).toString();
  parcel.length = parseInt(parcelLength);
  return parcel;
};

const parcel = ({
  // Encode parcel structure to Buffer
  parcelId,           // id, // parcelId: 4b
  parcelType,         // type, // parcelType: 1b
  compression,  // compression, // 1b: no = 0, gzip = 1
  encoding,     // encoding,
  // 1b: binary = 0, jstp = 1, json = 2, bson = 3, v8 = 4
  length        // length //string !!! // 8b
}) => {
  const parcel = Buffer.alloc(PARCEL_LENGTH);
  parcel.writeInt8(constObj.STRUCT_PARCEL);
  parcel.writeInt32LE(parcelId, 1);
  parcel.writeInt8(parcelType, 5);
  parcel.writeInt8(compression, 6);
  parcel.writeInt8(encoding, 7);
  length = '0'.repeat(8 - length.length) + length;
  parcel.write(length, 8);
  return parcel;
};

const readChunk = (buffer, length) => {
  // Read chunkk from buffer
  // Return chunk object
  const chunk = { structType: constObj.STRUCT_CHUNK };
  chunk.parcelId = buffer.readInt32LE(1);
  chunk.chunkId = buffer.readInt32LE(5);
  chunk.flags = buffer.readInt8(9);
  chunk.length = buffer.readInt16LE(10);
  chunk.payload = buffer.slice(12, length);
  return chunk;
};

const readPayloadLength = (buffer) =>
  buffer.readInt16LE(10);

const partPayload = (string, size = 2048) => {
  // Turn data into an array of payloads
  let chunkId = 1;
  let payload = string.substring(0, size);
  string = string.slice(size);

  const arrayOfPayloads = [
    {
      chunkId: chunkId++,
      payload: Buffer.from(payload),
      length: payload.length
    }
  ];

  while (string.length > 0) {
    payload = string.substring(0, size);
    string = string.slice(size);
    arrayOfPayloads.push({
      chunkId: chunkId++,
      payload: Buffer.from(payload),
      length: payload.length
    });
  }

  return arrayOfPayloads;
};

const chunk = ({
  // Encode chunk structure to Buffer
  parcelId, // parcelId, // 4b
  chunkId,  // chunkId, // 4b
  flag,    // flags, // 1b: more = 1, stop = 2, pause = 4, resume = 8
  length,   // length, // 2b
  payload   // payload // Buffer
}) => {
  const chunk = Buffer.alloc(CHUNK_LENGTH);
  chunk.writeInt8(constObj.STRUCT_CHUNK);
  // Write chunk fields to buffer
  chunk.writeInt32LE(parcelId, 1);
  chunk.writeInt32LE(chunkId, 5);
  chunk.writeInt8(flag, 9);
  chunk.writeInt16LE(length, 10);
  return Buffer.concat([chunk, payload], CHUNK_LENGTH + length);
};

const readHandshake = (buffer) => {
  // Read handshake from buffer
  // Return handshake object
  const rest = Buffer.from(buffer, 0, HANDSHAKE_LENGTH);
  const handshake = {};
  handshake.version = rest.readInt16LE(0);
  handshake.status = rest.readInt8(2);
  handshake.reserved = rest.readInt8(3);
  handshake.token = rest.readInt32LE(4);
  return handshake;
};

const handshake = ({
  // Encode handshake structure to Buffer
  status,   // status, // 1b: 0 = new, 1 = restore
  reserved, // reserved, // 1b
  token // token // 32b (optional)
}) => {
  const handshake = Buffer.alloc(HANDSHAKE_LENGTH);
  handshake.writeInt16LE(PROTOCOL_VERSION, 0);
  // Write handshake to buffer
  handshake.writeInt8(status, 2);
  handshake.writeInt8(reserved, 3);
  handshake.writeInt32LE(token, 4);
  return handshake;
};

const structTypes = [
  /* 0 */ readParcel,
  /* 1 */ readChunk
];

const readStructType = (buffer) =>
  // Read type of structure
  // Return type: parcel(0) or chunk(1)
  buffer.readInt8();

const readStruct = (buffer, length) => {
  // Read structure from buffer
  // Return parcel or chunk object
  const structType = buffer.readInt8(0, true);
  const parser = structTypes[structType];
  if (parser) return parser(buffer, length);
};

module.exports = Object.assign({
  handshake, readHandshake,
  chunk, readChunk,
  parcel, readParcel,
  readStruct, readStructType,
  partPayload, readPayloadLength
}, constObj);
