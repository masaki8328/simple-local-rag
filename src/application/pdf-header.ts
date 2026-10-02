// Byte-preserving screening only; this does not parse or establish PDF safety.
// Network chunk boundaries are irrelevant: callers accumulate the first nine bytes.
export function hasPDFHeader(bytes:Uint8Array):boolean{
 return bytes.length>=9 && (bytes[8]===0x0a||bytes[8]===0x0d) && bytes[0]===0x25 && bytes[1]===0x50 && bytes[2]===0x44 && bytes[3]===0x46 && bytes[4]===0x2d && bytes[6]===0x2e && ((bytes[5]===0x31&&bytes[7]>=0x30&&bytes[7]<=0x37)||(bytes[5]===0x32&&bytes[7]===0x30));
}
