import { DexAccessFlag } from "./dexfile";

export namespace DexUtils {

    /**
     * 计算 UTF-8 字符串的 31-based hash（与 Java String.hashCode 类似）。
     */
    // export function computeUtf8Hash(utf8Str: string): number {
    //     if (utf8Str == null) {
    //         throw new TypeError("utf8Str is null or undefined");
    //     }

    //     const bytes = new TextEncoder().encode(utf8Str);
    //     let hash = 1 >>> 0;
    //     for (let i = 0; i < bytes.length; i++) {
    //         hash = (hash * 31 + bytes[i]) >>> 0;
    //     }
    //     return hash;
    // }

    export function dotToDescriptor(str: string): string {
        if (str == null) {
            throw new TypeError("str is null or undefined");
        }
        if (str.length === 0) {
            throw new Error("str is empty");
        }

        const wrapElSemi = str[0] !== "[";
        const replaced = str.replace(/\./g, "/");
        return wrapElSemi ? `L${replaced};` : replaced;
    }

    export function descriptorToDot(str: string): string {
        if (str == null) {
            throw new TypeError("str is null or undefined");
        }

        let s = str;
        if (s.length >= 2 && s[0] === "L" && s[s.length - 1] === ";") {
            s = s.substring(1, s.length - 1);
        }

        return s.replace(/\//g, ".");
    }

    export function descriptorToJavaType(descriptor: string): string {
        if (descriptor == null) {
            throw new TypeError("descriptor is null or undefined");
        }
        if (descriptor.length === 0) {
            throw new Error("descriptor is empty");
        }

        let arrayDim = 0;
        while (arrayDim < descriptor.length && descriptor[arrayDim] === "[") {
            arrayDim++;
        }

        const base = descriptor.substring(arrayDim);
        let typeName: string;
        switch (base[0]) {
            case "B": typeName = "byte"; break;
            case "C": typeName = "char"; break;
            case "D": typeName = "double"; break;
            case "F": typeName = "float"; break;
            case "I": typeName = "int"; break;
            case "J": typeName = "long"; break;
            case "S": typeName = "short"; break;
            case "V": typeName = "void"; break;
            case "Z": typeName = "boolean"; break;
            case "L": {
                typeName = descriptorToDot(base);
                break;
            }
            default:
                typeName = descriptorToDot(base);
                break;
        }

        for (let i = 0; i < arrayDim; i++) {
            typeName += "[]";
        }
        return typeName;
    }

    export type AccessFlagKind = "class" | "field" | "method";

    export function accessFlagsToJavaModifierString(accessFlags: number, kind: AccessFlagKind): string {
        const mods: string[] = [];

        const isInterface = (accessFlags & DexAccessFlag.Interface) !== 0;
        const isEnum = (accessFlags & DexAccessFlag.Enum) !== 0;

        if (accessFlags & DexAccessFlag.Public)  mods.push("public");
        else if (accessFlags & DexAccessFlag.Protected) mods.push("protected");
        else if (accessFlags & DexAccessFlag.Private) mods.push("private");

        if (accessFlags & DexAccessFlag.Abstract) {
            if (!(kind === "class" && isInterface)) {
                mods.push("abstract");
            }
        }

        if (accessFlags & DexAccessFlag.Static) {
            if (kind === "field" || kind === "method" || kind === "class") {
                mods.push("static");
            }
        }

        if (accessFlags & DexAccessFlag.Final) {
            if (!(kind === "class" && (isInterface || isEnum))) {
                mods.push("final");
            }
        }

        if (kind === "field") {
            if (accessFlags & DexAccessFlag.Transient) mods.push("transient");
            if (accessFlags & DexAccessFlag.Volatile) mods.push("volatile");
        }

        if (kind === "method") {
            if (accessFlags & DexAccessFlag.Synchronized) mods.push("synchronized");
            if (accessFlags & DexAccessFlag.Native) mods.push("native");
            if (accessFlags & DexAccessFlag.Strict) mods.push("strictfp");
        }

        return mods.join(" ");
    }

    function rotl(value: number, bits: number): number {
        return ((value << bits) | (value >>> (32 - bits))) >>> 0;
    }

    export function computeAdler32(data: Uint8Array): number {
        const MOD_ADLER = 65521;
        let a = 1;
        let b = 0;

        for (let i = 0; i < data.length; i++) {
            a = (a + data[i]) % MOD_ADLER;
            b = (b + a) % MOD_ADLER;
        }

        return ((b << 16) | a) >>> 0;
    }

    function sha1Pad(data: Uint8Array): Uint8Array {
        const bitLen = data.length * 8;
        const padLen = (56 - ((data.length + 1) % 64) + 64) % 64;
        const totalLen = data.length + 1 + padLen + 8;
        const out = new Uint8Array(totalLen);
        out.set(data, 0);
        out[data.length] = 0x80;

        const high = Math.floor(bitLen / 0x100000000);
        const low = bitLen >>> 0;
        const lenOffset = totalLen - 8;

        out[lenOffset] = (high >>> 24) & 0xff;
        out[lenOffset + 1] = (high >>> 16) & 0xff;
        out[lenOffset + 2] = (high >>> 8) & 0xff;
        out[lenOffset + 3] = high & 0xff;
        out[lenOffset + 4] = (low >>> 24) & 0xff;
        out[lenOffset + 5] = (low >>> 16) & 0xff;
        out[lenOffset + 6] = (low >>> 8) & 0xff;
        out[lenOffset + 7] = low & 0xff;

        return out;
    }

    export function computeSha1(data: Uint8Array): Uint8Array {
        const padded = sha1Pad(data);
        let h0 = 0x67452301;
        let h1 = 0xefcdab89;
        let h2 = 0x98badcfe;
        let h3 = 0x10325476;
        let h4 = 0xc3d2e1f0;

        const w = new Uint32Array(80);

        for (let offset = 0; offset < padded.length; offset += 64) {
            for (let i = 0; i < 16; i++) {
                const j = offset + i * 4;
                w[i] = (
                    (padded[j] << 24)
                    | (padded[j + 1] << 16)
                    | (padded[j + 2] << 8)
                    | padded[j + 3]
                ) >>> 0;
            }

            for (let i = 16; i < 80; i++) {
                w[i] = rotl((w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]) >>> 0, 1);
            }

            let a = h0;
            let b = h1;
            let c = h2;
            let d = h3;
            let e = h4;

            for (let i = 0; i < 80; i++) {
                let f: number;
                let k: number;

                if (i < 20) {
                    f = (b & c) | ((~b) & d);
                    k = 0x5a827999;
                } else if (i < 40) {
                    f = b ^ c ^ d;
                    k = 0x6ed9eba1;
                } else if (i < 60) {
                    f = (b & c) | (b & d) | (c & d);
                    k = 0x8f1bbcdc;
                } else {
                    f = b ^ c ^ d;
                    k = 0xca62c1d6;
                }

                const temp = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
                e = d;
                d = c;
                c = rotl(b, 30);
                b = a;
                a = temp;
            }

            h0 = (h0 + a) >>> 0;
            h1 = (h1 + b) >>> 0;
            h2 = (h2 + c) >>> 0;
            h3 = (h3 + d) >>> 0;
            h4 = (h4 + e) >>> 0;
        }

        const out = new Uint8Array(20);
        const words = [h0, h1, h2, h3, h4];
        for (let i = 0; i < words.length; i++) {
            const v = words[i] >>> 0;
            out[i * 4] = (v >>> 24) & 0xff;
            out[i * 4 + 1] = (v >>> 16) & 0xff;
            out[i * 4 + 2] = (v >>> 8) & 0xff;
            out[i * 4 + 3] = v & 0xff;
        }

        return out;
    }

    export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }
}