package com.example.data.crypto

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object E2EEManager {
    private const val GCM_IV_LENGTH_BYTES = 12
    private const val GCM_TAG_LENGTH_BITS = 128
    private const val DEFAULT_SECRET_SALT = "Vortex-E2EE-Master-Key-2026"

    fun deriveChannelKey(serverId: String, channelId: String): SecretKeySpec {
        val input = "$serverId:$channelId:$DEFAULT_SECRET_SALT"
        val sha256 = MessageDigest.getInstance("SHA-256")
        val keyBytes = sha256.digest(input.toByteArray(Charsets.UTF_8))
        return SecretKeySpec(keyBytes, "AES")
    }

    fun encrypt(plainText: String, secretKey: SecretKeySpec, compress: Boolean = false): String {
        return try {
            var rawBytes = plainText.toByteArray(Charsets.UTF_8)
            if (compress) {
                rawBytes = compressBytes(rawBytes)
            }

            val iv = ByteArray(GCM_IV_LENGTH_BYTES)
            SecureRandom().nextBytes(iv)

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec)

            val cipherText = cipher.doFinal(rawBytes)

            val flag: Byte = if (compress) 1 else 0
            val byteBuffer = ByteBuffer.allocate(1 + iv.size + cipherText.size)
            byteBuffer.put(flag)
            byteBuffer.put(iv)
            byteBuffer.put(cipherText)

            "vtx_enc:" + encodeBase64(byteBuffer.array())
        } catch (e: Exception) {
            plainText
        }
    }

    fun decrypt(encryptedText: String, secretKey: SecretKeySpec): String {
        if (!encryptedText.startsWith("vtx_enc:")) {
            return encryptedText
        }
        return try {
            val encodedData = encryptedText.removePrefix("vtx_enc:")
            val rawPayload = decodeBase64(encodedData)
            val byteBuffer = ByteBuffer.wrap(rawPayload)

            val flag = byteBuffer.get()
            val isCompressed = flag.toInt() == 1

            val iv = ByteArray(GCM_IV_LENGTH_BYTES)
            byteBuffer.get(iv)

            val cipherBytes = ByteArray(byteBuffer.remaining())
            byteBuffer.get(cipherBytes)

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)

            val decryptedBytes = cipher.doFinal(cipherBytes)
            val finalBytes = if (isCompressed) decompressBytes(decryptedBytes) else decryptedBytes

            String(finalBytes, Charsets.UTF_8)
        } catch (e: Exception) {
            "[Encrypted message - key mismatch or corrupt]"
        }
    }

    fun generateSafetyFingerprint(channelId: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(channelId.toByteArray(Charsets.UTF_8))
        val sb = StringBuilder()
        for (i in 0 until 6) {
            val num = (digest[i].toInt() and 0xFF) * 100
            sb.append(String.format("%04d", num % 10000))
            if (i < 5) sb.append(" ")
        }
        return sb.toString()
    }

    private fun compressBytes(data: ByteArray): ByteArray {
        val bos = ByteArrayOutputStream()
        GZIPOutputStream(bos).use { it.write(data) }
        return bos.toByteArray()
    }

    private fun decompressBytes(data: ByteArray): ByteArray {
        val bis = ByteArrayInputStream(data)
        GZIPInputStream(bis).use { return it.readBytes() }
    }

    private fun encodeBase64(bytes: ByteArray): String {
        return try {
            java.util.Base64.getEncoder().encodeToString(bytes)
        } catch (e: Throwable) {
            android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
        }
    }

    private fun decodeBase64(str: String): ByteArray {
        return try {
            java.util.Base64.getDecoder().decode(str)
        } catch (e: Throwable) {
            android.util.Base64.decode(str, android.util.Base64.NO_WRAP)
        }
    }
}
