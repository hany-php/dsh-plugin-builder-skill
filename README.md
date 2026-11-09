# 🛠️ dsh-plugin-builder-skill

<p align="right">
  <strong>إضافة مهارة بناء الإضافات لـ DeepSeek Harness</strong><br>
  هذه الإضافة تضيف مهارة متقدمة تسمى <code>create-dsh-plugin</code> تساعد المطورين في بناء إضافات (Plugins) متكاملة لبيئة DeepSeek Harness، تشمل عناصر القائمة الجانبية، أدوات المضيف (Host tools)، وصفوف MCP.
</p>

---

## 🌍 الوصف بالعربية
هذه الحزمة مخصصة لملف تعريف (Profile) الخاص بـ DeepSeek Harness، حيث تضيف مهارة يمكن استدعاؤها بواسطة الذكاء الاصطناعي تسمى: **`create-dsh-plugin`**.

تعتبر هذه المهارة "دليل عمل" (Playbook) لإنشاء إضافات دائمة في DSH، مثل: مدخلات في القائمة الجانبية اليسرى، زخارف لواجهة المستخدم، أدوات أو خدمات في المضيف (Host)، أو صفوف MCP. وتتضمن المهارة عمليات التحقق من الصحة (Validation)، التثبيت المباشر في الملف الشخصي، وإعادة تكوين الحزم المعدلة لضمان عملها بشكل صحيح.

## 🚀 التركيب (Installation)

### 🤖 باستخدام الذكاء الاصطناعي
إذا كان لديك جلسة مفتوحة، يمكنك طلب التثبيت من العميل (Agent) عبر تزويده بمسار المجلد.

**مثال على الطلب:**
> "من فضلك قم بتثبيت حزمة الإضافة الموجودة في المسار `[المسار المطلق لهذا المجلد]` باستخدام أداة `plugin_manager`."

**الأمر التقني الذي سيقوم به الذكاء الاصطناعي:**
```javascript
plugin_manager install_bundle { target: "<absolute path to this directory>" }
```

### 🛠️ التركيب اليدوي
1. قم بتحميل أو نسخ هذا المستودع على جهازك.
2. استخدم أداة `plugin_manager` داخل DeepSeek Harness لتثبيت الحزمة عن طريق توجيهها إلى المجلد الذي يحتوي على ملف `package.json`.

## 📖 طريقة الاستخدام
بمجرد التثبيت، تصبح المهارة `create-dsh-plugin` متاحة في دليل مهارات العميل.

### 1. استدعاء المهارة
يمكنك تحميل المهارة بشكل صريح في أي جلسة:
```javascript
skill { name: "create-dsh-plugin" }
```

### 2. بناء إضافة
بعد تحميل المهارة، يمكنك طلب الآتي من الذكاء الاصطناعي:
- **إنشاء أداة جديدة:** "قم بإنشاء أداة مضيف DSH تقوم بحساب X."
- **إضافة عنصر للقائمة الجانبية:** "أضف مدخلاً جديداً للقائمة الجانبية اليسرى لمشروعي."
- **التحقق من الحزمة:** "تحقق مما إذا كانت حزمة الإضافة الخاصة بي صالحة."

## 📂 هيكل المشروع

| المسار | الدور |
|---|---|
| `index.js` | إضافة مزود المضيف: تقوم بتسجيل المهارة. |
| `cordis.patch.yml` | رقعة التحميل التي تدرج صف المزود. |
| `assets/create-dsh-plugin/SKILL.md` | محتوى المهارة الذي يتم تحميله بواسطة أداة `skill`. |
| `assets/create-dsh-plugin/references/` | أدلة تنسيق الحزم والتغليف. |
| `assets/create-dsh-plugin/scripts/` | سكربتات التحقق واختبارات التشغيل الأولية. |
| `locale/en.json`, `locale/ar.json` | بيانات العرض (إنجليزي/عربي). |
| `icon.svg` | أيقونة الإضافة. |

## 🔍 التحقق
للتأكد من أن كل شيء يعمل بشكل صحيح، يمكنك تشغيل:
```bash
node assets/create-dsh-plugin/scripts/check-bundle.mjs .
```
ثم قم بتأكيد الصف المباشر باستخدام `cordis_inspect_query` للمضيف `Config.listConfigs` مع تصفية الاسم `dsh-plugin-builder-skill`.

---
---

## 🌐 English Description
A bundle for the DeepSeek Harness profile that adds one model-invocable skill: **`create-dsh-plugin`**.

The skill is a working playbook for creating a persistent DSH plugin — a left-sidebar entry, a UI decoration, a Host tool/service, or an MCP row — including offline validation, live installation into the profile, recomposition of an edited bundle, and the evidence that proves it actually works.

## 🚀 Installation

### 🤖 Using AI (via DSH Tool)
If you have a session open, you can ask the agent to install it by providing the path to this folder.

**Prompt Example:**
> "Please install the plugin bundle located at `[Absolute Path to this Folder]` using the `plugin_manager` tool."

**Technical Command:**
```javascript
plugin_manager install_bundle { target: "<absolute path to this directory>" }
```

### 🛠️ Manual Installation
1. Clone or download this repository to your local machine.
2. Use the `plugin_manager` tool within DeepSeek Harness to install the bundle by pointing it to the folder containing `package.json`.

## 📖 How to Use
Once installed, the skill `create-dsh-plugin` becomes available in the agent's skill catalog.

### 1. Invoking the Skill
You can load the skill explicitly in any session:
```javascript
skill { name: "create-dsh-plugin" }
```

### 2. Building a Plugin
After loading the skill, you can ask the AI to:
- **Create a new tool:** "Create a DSH host tool that calculates X."
- **Add a sidebar item:** "Add a new entry to the left sidebar for my project."
- **Validate a bundle:** "Check if my plugin bundle is valid."

## 📂 Project Structure

| Path | Role |
|---|---|
| `index.js` | Host provider plugin: registers the skill. |
| `cordis.patch.yml` | Loader patch that inserts the provider row. |
| `assets/create-dsh-plugin/SKILL.md` | The skill body loaded by the `skill` tool. |
| `assets/create-dsh-plugin/references/` | Bundle format and packaging guides. |
| `assets/create-dsh-plugin/scripts/` | Validation and smoke test scripts. |
| `locale/en.json`, `locale/ar.json` | Display metadata (English/Arabic). |
| `icon.svg` | Plugin Manager artwork. |

## 🔍 Verification
To ensure everything is working correctly, you can run:
```bash
node assets/create-dsh-plugin/scripts/check-bundle.mjs .
```
Then confirm the live row with `cordis_inspect_query` host `Config.listConfigs` filtered by `name: "dsh-plugin-builder-skill"`.
