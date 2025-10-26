// 依賴：先載入 fflate.js（提供 gzip/gunzip 與字串/位元組轉換）

(function (global) {
    "use strict";

    // ===== Base91 編碼/解碼（只用可列印 ASCII，安全存到 Segment） =====
    const BASE91_TABLE =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" +
        "!#$%&()*+,./:;<=>?@[]^_`{|}~\"";
    const BASE91_DICT = Object.fromEntries([...BASE91_TABLE].map((c, i) => [c, i]));

    /** 將位元組（Uint8Array）編成 Base91 文字 */
    function base91Encode(bytes) {
        let b = 0, n = 0, out = "";
        for (let i = 0; i < bytes.length; i++) {
            b |= bytes[i] << n; n += 8;
            if (n > 13) {
                let v = b & 8191;
                if (v > 88) { b >>= 13; n -= 13; }
                else { v = b & 16383; b >>= 14; n -= 14; }
                out += BASE91_TABLE[v % 91] + BASE91_TABLE[Math.floor(v / 91)];
            }
        }
        if (n) out += BASE91_TABLE[b % 91] + (n > 7 || b > 90 ? BASE91_TABLE[Math.floor(b / 91)] : "");
        return out;
    }

    /** 將 Base91 文字解成位元組（Uint8Array） */
    function base91Decode(str) {
        let b = 0, n = 0, out = [], v = -1;
        for (let i = 0; i < str.length; i++) {
            const code = BASE91_DICT[str[i]];
            if (code === undefined) continue;
            if (v < 0) v = code;
            else {
                v += code * 91;
                b |= v << n; n += (v & 8191) > 88 ? 13 : 14;
                do { out.push(b & 255); b >>= 8; n -= 8; } while (n > 7);
                v = -1;
            }
        }
        if (v + 1) out.push((b | (v << n)) & 255);
        return new Uint8Array(out);
    }

    // ===== GZIP + Base91：壓縮/解壓 =====

    /**
     * 壓縮成可儲存於 Twitch Segment 的字串
     * @param {string} text 原始文字（UTF-8）
     * @returns {{encoded: string, binaryLength: number, encoding: 'base91', algo: 'gzip'}}
     */
    function compressToStorableString(text) {
        // 文字 → UTF-8 位元組 → GZIP → Base91
        const u8 = fflate.strToU8(text);                      // UTF-8 編碼
        const gz = fflate.gzipSync(u8);                       // GZIP 壓縮
        const encoded = base91Encode(gz);                     // Base91 文字
        return {
            encodedString: encoded,
            originalLength: u8.length,
            compressedLength: gz.length,
            encoding: 'base91'
            , algo: 'gzip'
        };
    }

    /**
     * 從可儲存字串解壓回原文字
     * @param {string} encoded 透過 compressToStorableString 產生的 Base91 文字
     * @returns {string} 原始文字（UTF-8）
     */
    function decompressFromStorableString(encoded) {
        // Base91 → GUNZIP → 文字
        const gz = base91Decode(encoded);
        const u8 = fflate.gunzipSync(gz);
        return fflate.strFromU8(u8);
    }

    // 導出到全域（避免模組化複雜度）
    global.CompressionHelper = {
        // 壓縮/解壓（主要給 admin/overlay 用）
        compressToStorableString,
        decompressFromStorableString,

        // 若未來要換 Brotli、Base64 等，可在此擴充，不影響呼叫端
        _base91Encode: base91Encode,
        _base91Decode: base91Decode
    };
})(window);
