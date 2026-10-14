package com.example

import com.example.data.crypto.E2EEManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ExampleUnitTest {
    @Test
    fun addition_isCorrect() {
        assertEquals(4, 2 + 2)
    }

    @Test
    fun e2ee_encrypt_decrypt_roundtrip() {
        val key = E2EEManager.deriveChannelKey("server_123", "channel_abc")
        val secretMessage = "Top secret Discord chat message with E2EE!"

        val encrypted = E2EEManager.encrypt(secretMessage, key, compress = false)
        assertTrue(encrypted.startsWith("vtx_enc:"))
        assertNotEquals(secretMessage, encrypted)

        val decrypted = E2EEManager.decrypt(encrypted, key)
        assertEquals(secretMessage, decrypted)
    }

    @Test
    fun e2ee_low_bandwidth_compression_roundtrip() {
        val key = E2EEManager.deriveChannelKey("server_123", "channel_abc")
        val longMessage = "Low-bandwidth payload test ".repeat(20)

        val encryptedCompressed = E2EEManager.encrypt(longMessage, key, compress = true)
        assertTrue(encryptedCompressed.startsWith("vtx_enc:"))

        val decrypted = E2EEManager.decrypt(encryptedCompressed, key)
        assertEquals(longMessage, decrypted)
    }

    @Test
    fun e2ee_safety_fingerprint_generation() {
        val fingerprint1 = E2EEManager.generateSafetyFingerprint("channel_123")
        val fingerprint2 = E2EEManager.generateSafetyFingerprint("channel_123")
        assertEquals(fingerprint1, fingerprint2)
        assertEquals(29, fingerprint1.length) // 6 groups of 4 digits + 5 spaces = 29 chars
    }
}
