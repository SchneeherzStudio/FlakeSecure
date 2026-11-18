const {
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const AUTOFILL_XML = `<?xml version="1.0" encoding="utf-8"?>
<autofill-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:settingsActivity="com.snowy.studio.FlakeSecure.MainActivity"
    android:supportsInlineSuggestions="true" />
`;

function getServiceKt(pkg) {
  return `package ${pkg}.autofill

import android.app.PendingIntent
import android.app.assist.AssistStructure
import android.content.Intent
import android.os.Build
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillContext
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveInfo
import android.service.autofill.SaveRequest
import android.view.View
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import androidx.annotation.RequiresApi
import org.json.JSONArray
import org.json.JSONObject

@RequiresApi(Build.VERSION_CODES.O)
class FlakeSecureAutofillService : AutofillService() {

    data class ParsedFields(
        var usernameId: AutofillId? = null,
        var passwordId: AutofillId? = null,
        var cardNumberId: AutofillId? = null,
        var cardExpiryId: AutofillId? = null,
        var cardCvvId: AutofillId? = null,
        var webDomain: String? = null,
        var packageName: String? = null,
        var usernameValue: String? = null,
        var passwordValue: String? = null
    )

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        val contexts: List<FillContext> = request.fillContexts
        val structure: AssistStructure = contexts.lastOrNull()?.structure ?: run {
            callback.onSuccess(null)
            return
        }

        val parsed = parseStructure(structure)
        val hasLoginFields = parsed.usernameId != null || parsed.passwordId != null
        val hasCardFields = parsed.cardNumberId != null || parsed.cardCvvId != null

        if (!hasLoginFields && !hasCardFields) {
            callback.onSuccess(null)
            return
        }

        val targetDomain = resolveDomain(parsed)
        val responseBuilder = FillResponse.Builder()

        val authIntent = Intent(this, FlakeSecureAutofillAuthActivity::class.java).apply {
            putExtra("targetDomain", targetDomain)
            putExtra("packageName", parsed.packageName ?: "")
            putExtra("usernameId", parsed.usernameId)
            putExtra("passwordId", parsed.passwordId)
            putExtra("cardNumberId", parsed.cardNumberId)
            putExtra("cardExpiryId", parsed.cardExpiryId)
            putExtra("cardCvvId", parsed.cardCvvId)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            (System.currentTimeMillis() and 0xFFFFFFF).toInt(),
            authIntent,
            flags
        )

        val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
            val label = if (hasCardFields && !hasLoginFields) {
                "FlakeSecure: Bankkarte entsperren"
            } else if (targetDomain.isNotEmpty()) {
                "FlakeSecure entsperren ($targetDomain)"
            } else {
                "Mit FlakeSecure ausfüllen"
            }
            setTextViewText(android.R.id.text1, label)
        }

        val trackedIds = mutableListOf<AutofillId>()
        parsed.usernameId?.let { trackedIds.add(it) }
        parsed.passwordId?.let { trackedIds.add(it) }
        parsed.cardNumberId?.let { trackedIds.add(it) }
        parsed.cardExpiryId?.let { trackedIds.add(it) }
        parsed.cardCvvId?.let { trackedIds.add(it) }

        if (trackedIds.isNotEmpty()) {
            responseBuilder.setAuthentication(
                trackedIds.toTypedArray(),
                pendingIntent.intentSender,
                presentation
            )
        }

        if (parsed.usernameId != null && parsed.passwordId != null) {
            val saveInfo = SaveInfo.Builder(
                SaveInfo.SAVE_DATA_TYPE_USERNAME or SaveInfo.SAVE_DATA_TYPE_PASSWORD,
                arrayOf(parsed.usernameId!!, parsed.passwordId!!)
            ).build()
            responseBuilder.setSaveInfo(saveInfo)
        }

        callback.onSuccess(responseBuilder.build())
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        try {
            val structure = request.fillContexts.lastOrNull()?.structure
            if (structure != null) {
                val parsed = parseStructure(structure)
                val domain = resolveDomain(parsed)
                val username = parsed.usernameValue ?: ""
                val password = parsed.passwordValue ?: ""
                if (domain.isNotEmpty() && password.isNotEmpty()) {
                    FlakeSecureAutofillCrypto.appendPendingSave(
                        applicationContext,
                        domain,
                        username,
                        password
                    )
                }
            }
            callback.onSuccess()
        } catch (e: Exception) {
            callback.onFailure(e.message ?: "Save failed")
        }
    }

    private fun resolveDomain(parsed: ParsedFields): String {
        val web = parsed.webDomain?.trim()?.lowercase() ?: ""
        if (web.isNotEmpty()) return web
        val pkg = parsed.packageName?.trim()?.lowercase() ?: ""
        if (pkg.isEmpty() ||
            pkg.contains("chrome") ||
            pkg.contains("firefox") ||
            pkg.contains("brave") ||
            pkg.contains("opera") ||
            pkg.contains("sbrowser") ||
            pkg.contains("edge")
        ) {
            return ""
        }
        val parts = pkg.split(".")
        return if (parts.size >= 2) {
            parts.reversed().take(2).joinToString(".")
        } else {
            pkg
        }
    }

    private fun parseStructure(structure: AssistStructure): ParsedFields {
        val result = ParsedFields()
        result.packageName = structure.activityComponent?.packageName
        val nodes = structure.windowNodeCount
        for (i in 0 until nodes) {
            val windowNode = structure.getWindowNodeAt(i)
            traverseNode(windowNode.rootViewNode, result)
        }
        return result
    }

    private fun traverseNode(node: AssistStructure.ViewNode?, out: ParsedFields) {
        if (node == null) return
        node.webDomain?.let {
            if (it.isNotBlank() && out.webDomain.isNullOrBlank()) {
                out.webDomain = it
            }
        }

        val autofillId = node.autofillId
        val hints = node.autofillHints?.map { it.lowercase() } ?: emptyList()
        val idEntry = (node.idEntry ?: "").lowercase()
        val hintText = (node.hint ?: "").toString().lowercase()
        val textVal = node.autofillValue?.let {
            if (it.isText) it.textValue?.toString() else null
        }

        if (autofillId != null) {
            val isPassword = hints.any { it.contains("password") } ||
                idEntry.contains("password") ||
                idEntry.contains("passwd") ||
                hintText.contains("passwort") ||
                hintText.contains("password") ||
                (node.inputType and 0x00000080) != 0 ||
                (node.inputType and 0x00000010) != 0

            val isUsername = hints.any {
                it.contains("username") || it.contains("email") || it.contains("login")
            } || idEntry.contains("user") || idEntry.contains("email") || idEntry.contains("login") ||
                hintText.contains("e-mail") || hintText.contains("email") || hintText.contains("benutzer")

            val isCardNumber = hints.any { it.contains("creditcardnumber") || it.contains("cardnumber") } ||
                idEntry.contains("card_number") || idEntry.contains("cc-number") ||
                hintText.contains("kartennummer") || hintText.contains("card number")

            val isCardExpiry = hints.any { it.contains("creditcardexpiration") } ||
                idEntry.contains("cc-exp") || idEntry.contains("expiry")

            val isCardCvv = hints.any { it.contains("creditcardsecuritycode") } ||
                idEntry.contains("cvv") || idEntry.contains("cvc") || hintText.contains("cvv")

            if (isCardNumber && out.cardNumberId == null) {
                out.cardNumberId = autofillId
            } else if (isCardExpiry && out.cardExpiryId == null) {
                out.cardExpiryId = autofillId
            } else if (isCardCvv && out.cardCvvId == null) {
                out.cardCvvId = autofillId
            } else if (isPassword && out.passwordId == null) {
                out.passwordId = autofillId
                out.passwordValue = textVal
            } else if (isUsername && out.usernameId == null) {
                out.usernameId = autofillId
                out.usernameValue = textVal
            }
        }

        for (i in 0 until node.childCount) {
            traverseNode(node.getChildAt(i), out)
        }
    }
}
`;
}

function getAuthActivityKt(pkg) {
  return `package ${pkg}.autofill

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.service.autofill.Dataset
import android.service.autofill.FillResponse
import android.view.autofill.AutofillId
import android.view.autofill.AutofillManager
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import androidx.annotation.RequiresApi
import org.json.JSONArray
import org.json.JSONObject

@RequiresApi(Build.VERSION_CODES.O)
class FlakeSecureAutofillAuthActivity : Activity() {

    private val REQUEST_CONFIRM_DEVICE_CREDENTIAL = 9101

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        if (keyguard != null && keyguard.isKeyguardSecure) {
            @Suppress("DEPRECATION")
            val confirmIntent = keyguard.createConfirmDeviceCredentialIntent(
                "FlakeSecure Autofill",
                "Entsperre deinen Tresor zum automatischen Ausfüllen"
            )
            if (confirmIntent != null) {
                startActivityForResult(confirmIntent, REQUEST_CONFIRM_DEVICE_CREDENTIAL)
                return
            }
        }
        deliverAutofillResult()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_CONFIRM_DEVICE_CREDENTIAL) {
            if (resultCode == RESULT_OK) {
                deliverAutofillResult()
            } else {
                setResult(RESULT_CANCELED)
                finish()
            }
        }
    }

    private fun deliverAutofillResult() {
        try {
            val targetDomain = (intent.getStringExtra("targetDomain") ?: "").lowercase()
            val usernameId = intent.getParcelableExtra<AutofillId>("usernameId")
            val passwordId = intent.getParcelableExtra<AutofillId>("passwordId")
            val cardNumberId = intent.getParcelableExtra<AutofillId>("cardNumberId")
            val cardExpiryId = intent.getParcelableExtra<AutofillId>("cardExpiryId")
            val cardCvvId = intent.getParcelableExtra<AutofillId>("cardCvvId")

            val vaultJson = FlakeSecureAutofillCrypto.readVaultJson(applicationContext)
            if (vaultJson.isNullOrBlank()) {
                setResult(RESULT_CANCELED)
                finish()
                return
            }

            val root = JSONObject(vaultJson)
            val credentials = root.optJSONArray("credentials") ?: JSONArray()
            val cards = root.optJSONArray("cards") ?: JSONArray()

            val responseBuilder = FillResponse.Builder()
            var datasetCount = 0

            if (usernameId != null || passwordId != null) {
                for (i in 0 until credentials.length()) {
                    val item = credentials.optJSONObject(i) ?: continue
                    val domain = item.optString("domain", "").lowercase()
                    val username = item.optString("username", "")
                    val password = item.optString("password", "")
                    if (username.isEmpty() && password.isEmpty()) continue

                    val matches = targetDomain.isEmpty() ||
                        domain == targetDomain ||
                        targetDomain.endsWith(".$domain") ||
                        domain.endsWith(".$targetDomain")

                    if (!matches && credentials.length() > 8) continue

                    val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
                        setTextViewText(android.R.id.text1, "$username ($domain)")
                    }
                    val dsBuilder = Dataset.Builder(presentation)
                    if (usernameId != null) {
                        dsBuilder.setValue(usernameId, AutofillValue.forText(username), presentation)
                    }
                    if (passwordId != null) {
                        dsBuilder.setValue(passwordId, AutofillValue.forText(password), presentation)
                    }
                    responseBuilder.addDataset(dsBuilder.build())
                    datasetCount++
                }
            }

            if (cardNumberId != null || cardCvvId != null) {
                for (i in 0 until cards.length()) {
                    val card = cards.optJSONObject(i) ?: continue
                    val label = card.optString("label", "Bankkarte")
                    val number = card.optString("number", "")
                    val expMonth = card.optString("expiryMonth", "")
                    val expYear = card.optString("expiryYear", "")
                    val cvv = card.optString("cvv", "")
                    if (number.isEmpty()) continue

                    val last4 = if (number.length >= 4) number.takeLast(4) else number
                    val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
                        setTextViewText(android.R.id.text1, "$label (•••• $last4)")
                    }
                    val dsBuilder = Dataset.Builder(presentation)
                    if (cardNumberId != null) {
                        dsBuilder.setValue(cardNumberId, AutofillValue.forText(number), presentation)
                    }
                    if (cardExpiryId != null && expMonth.isNotEmpty() && expYear.isNotEmpty()) {
                        dsBuilder.setValue(cardExpiryId, AutofillValue.forText("$expMonth/$expYear"), presentation)
                    }
                    if (cardCvvId != null && cvv.isNotEmpty()) {
                        dsBuilder.setValue(cardCvvId, AutofillValue.forText(cvv), presentation)
                    }
                    responseBuilder.addDataset(dsBuilder.build())
                    datasetCount++
                }
            }

            if (datasetCount == 0) {
                setResult(RESULT_CANCELED)
                finish()
                return
            }

            val replyIntent = Intent().apply {
                putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, responseBuilder.build())
            }
            setResult(RESULT_OK, replyIntent)
        } catch (e: Exception) {
            setResult(RESULT_CANCELED)
        }
        finish()
    }
}
`;
}

function getCryptoHelperKt(pkg) {
  return `package ${pkg}.autofill

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object FlakeSecureAutofillCrypto {
    private const val KEYSTORE_ALIAS = "FlakeSecureAutofillMasterKey_v1"
    private const val PREFS_NAME = "flakesecure_autofill_secure_prefs"
    private const val KEY_VAULT_BLOB = "encrypted_vault_blob"
    private const val KEY_PENDING_SAVES = "encrypted_pending_saves"

    private fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = keyStore.getEntry(KEYSTORE_ALIAS, null) as? KeyStore.SecretKeyEntry
        if (existing != null) return existing.secretKey

        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        )
        val spec = KeyGenParameterSpec.Builder(
            KEYSTORE_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }

    private fun encryptString(plain: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())
        val iv = cipher.iv
        val encrypted = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
        val ivB64 = Base64.encodeToString(iv, Base64.NO_WRAP)
        val dataB64 = Base64.encodeToString(encrypted, Base64.NO_WRAP)
        return "$ivB64:$dataB64"
    }

    private fun decryptString(packed: String?): String? {
        if (packed.isNullOrBlank() || !packed.contains(":")) return null
        val parts = packed.split(":", limit = 2)
        val iv = Base64.decode(parts[0], Base64.NO_WRAP)
        val cipherBytes = Base64.decode(parts[1], Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateSecretKey(), GCMParameterSpec(128, iv))
        val plainBytes = cipher.doFinal(cipherBytes)
        return String(plainBytes, Charsets.UTF_8)
    }

    fun writeVaultJson(context: Context, json: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_VAULT_BLOB, encryptString(json)).apply()
    }

    fun readVaultJson(context: Context): String? {
        return try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            decryptString(prefs.getString(KEY_VAULT_BLOB, null))
        } catch (e: Exception) {
            null
        }
    }

    fun appendPendingSave(context: Context, domain: String, username: String, password: String) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val existingStr = decryptString(prefs.getString(KEY_PENDING_SAVES, null))
            val arr = if (!existingStr.isNullOrBlank()) JSONArray(existingStr) else JSONArray()
            val obj = JSONObject().apply {
                put("domain", domain)
                put("username", username)
                put("password", password)
                put("savedAt", System.currentTimeMillis())
            }
            arr.put(obj)
            prefs.edit().putString(KEY_PENDING_SAVES, encryptString(arr.toString())).apply()
        } catch (_: Exception) {}
    }

    fun consumePendingSaves(context: Context): String {
        return try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val existingStr = decryptString(prefs.getString(KEY_PENDING_SAVES, null)) ?: "[]"
            prefs.edit().remove(KEY_PENDING_SAVES).apply()
            existingStr
        } catch (e: Exception) {
            "[]"
        }
    }
}
`;
}

function getModuleKt(pkg) {
  return `package ${pkg}.autofill

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.autofill.AutofillManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FlakeSecureAutofillModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FlakeSecureAutofill"

    @ReactMethod
    fun isAutofillEnabled(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                promise.resolve(false)
                return
            }
            val afm = reactContext.getSystemService(AutofillManager::class.java)
            promise.resolve(afm != null && afm.hasEnabledAutofillServices())
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openAutofillSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                promise.resolve(false)
                return
            }
            val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE).apply {
                data = Uri.parse("package:" + reactContext.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            try {
                val fallback = Intent(Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(fallback)
                promise.resolve(true)
            } catch (err: Exception) {
                promise.resolve(false)
            }
        }
    }

    @ReactMethod
    fun syncVaultForAutofill(payloadJson: String, promise: Promise) {
        try {
            FlakeSecureAutofillCrypto.writeVaultJson(reactContext.applicationContext, payloadJson)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_AUTOFILL_SYNC", e.message, e)
        }
    }

    @ReactMethod
    fun consumePendingSavedCredentials(promise: Promise) {
        try {
            val json = FlakeSecureAutofillCrypto.consumePendingSaves(reactContext.applicationContext)
            promise.resolve(json)
        } catch (e: Exception) {
            promise.resolve("[]")
        }
    }
}
`;
}

function getPackageKt(pkg) {
  return `package ${pkg}.autofill

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class FlakeSecureAutofillPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(FlakeSecureAutofillModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;
}

function withFlakeSecureAutofill(config) {
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) return modConfig;

    app.service = app.service || [];
    const serviceName = '.autofill.FlakeSecureAutofillService';
    const existingService = app.service.find(
      (s) => s.$?.['android:name'] === serviceName
    );
    if (!existingService) {
      app.service.push({
        $: {
          'android:name': serviceName,
          'android:label': 'FlakeSecure',
          'android:permission': 'android.permission.BIND_AUTOFILL_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.service.autofill.AutofillService',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.autofill',
              'android:resource': '@xml/flakesecure_autofill_service',
            },
          },
        ],
      });
    }

    app.activity = app.activity || [];
    const authActName = '.autofill.FlakeSecureAutofillAuthActivity';
    const existingAct = app.activity.find(
      (a) => a.$?.['android:name'] === authActName
    );
    if (!existingAct) {
      app.activity.push({
        $: {
          'android:name': authActName,
          'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
          'android:exported': 'false',
          'android:excludeFromRecents': 'true',
        },
      });
    }

    return modConfig;
  });

  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.platformProjectRoot;
      const pkg =
        modConfig.android?.package || 'com.snowy.studio.FlakeSecure';
      const pkgPath = pkg.replace(/\./g, '/');

      const xmlDir = path.join(projectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'flakesecure_autofill_service.xml'),
        AUTOFILL_XML,
        'utf8'
      );

      const ktDir = path.join(
        projectRoot,
        'app/src/main/java',
        pkgPath,
        'autofill'
      );
      fs.mkdirSync(ktDir, { recursive: true });
      fs.writeFileSync(
        path.join(ktDir, 'FlakeSecureAutofillService.kt'),
        getServiceKt(pkg),
        'utf8'
      );
      fs.writeFileSync(
        path.join(ktDir, 'FlakeSecureAutofillAuthActivity.kt'),
        getAuthActivityKt(pkg),
        'utf8'
      );
      fs.writeFileSync(
        path.join(ktDir, 'FlakeSecureAutofillCrypto.kt'),
        getCryptoHelperKt(pkg),
        'utf8'
      );
      fs.writeFileSync(
        path.join(ktDir, 'FlakeSecureAutofillModule.kt'),
        getModuleKt(pkg),
        'utf8'
      );
      fs.writeFileSync(
        path.join(ktDir, 'FlakeSecureAutofillPackage.kt'),
        getPackageKt(pkg),
        'utf8'
      );

      const mainAppKt = path.join(
        projectRoot,
        'app/src/main/java',
        pkgPath,
        'MainApplication.kt'
      );
      if (fs.existsSync(mainAppKt)) {
        let content = fs.readFileSync(mainAppKt, 'utf8');
        const importLine = `import ${pkg}.autofill.FlakeSecureAutofillPackage`;
        if (!content.includes(importLine)) {
          content = content.replace(
            /^package\s+[^\r\n]+/m,
            (match) => `${match}\n${importLine}`
          );
        }
        if (!content.includes('FlakeSecureAutofillPackage()')) {
          content = content.replace(
            /PackageList\(this\)\.packages\.apply\s*\{/,
            `PackageList(this).packages.apply {\n              add(FlakeSecureAutofillPackage())`
          );
        }
        fs.writeFileSync(mainAppKt, content, 'utf8');
      }

      return modConfig;
    },
  ]);

  return config;
}

module.exports = withFlakeSecureAutofill;
