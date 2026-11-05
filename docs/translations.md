# Languages

Choose **Language** in Settings or in **Help & documentation**, which is available before unlocking. The first launch follows the browser's language when supported. Your choice is saved on this device and can be changed without changing the vault or its password.

The first translation pass includes English, Spanish, French, German, Portuguese, Russian, Arabic, Hindi, Bengali, Urdu, Indonesian, Japanese, Korean, Simplified Chinese and Turkish, plus Romanian, Norwegian Bokmål, Finnish, Swedish, Icelandic and Danish. This is a selection of widely used languages, not a population ranking. Portuguese uses Brazilian wording; Norwegian is Bokmål.

Every language has the core navigation, account and backup controls, password prompts, key safety notices and accessible code labels. Some longer help, detailed import reports, migration guidance and the full GitHub documentation remain in English. Missing translations fall back to the original English text.

Translations are bundled and loaded locally only when selected. No translation service, network request, browser permission or runtime dependency is added. Translations apply to interface text. Your accounts and secrets are not translated or sent to a translation service. Arabic and Urdu use a right-to-left interface; code digits retain their original order.

## Reviewing or adding translations

The source messages are in src/locales/en.json. Each other JSON file maps an English source message to its translation. Keep placeholders such as {name}, {code} and {seconds} exactly as written; they are inserted as text, never HTML. src/locales/required.json lists the core messages required in every language. New messages can fall back to English while translations are reviewed.

These are initial translations, not a claim of professional or native-speaker review. Corrections are welcome, especially for backup passwords, destructive actions, HOTP counters and the meaning of locking. Run the unit tests and browser checks after editing. Check the 400 px popup, keyboard navigation, long labels and both writing directions.

The tests check required coverage, placeholder parity, fallback, language preferences and direction metadata. Automated checks cannot establish that every translation is natural or unambiguous.
