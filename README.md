# 🛠️ dsh-plugin-builder-skill

<p align="right">
  <strong>إضافة مهارة بناء الإضافات لـ DeepSeek Harness</strong><br>
  هذه الإضافة تضيف مهارة متقدمة تسمى <code>create-dsh-plugin</code> تساعد المطورين في بناء إضافات (Plugins) متكاملة لبيئة DeepSeek Harness، تشمل عناصر القائمة الجانبية، أدوات المضيف (Host tools)، وصفوف MCP.
</p>

---

## 🌐 English Description
A bundle for the DeepSeek Harness profile that adds one model-invocable skill: **`create-dsh-plugin`**.

The skill is a working playbook for creating a persistent DSH plugin — a left-sidebar entry, a UI decoration, a Host tool/service, or an MCP row — including offline validation, live installation into the profile, recomposition of an edited bundle, and the evidence that proves it actually works.

## 🌍 الوصف بالعربية
هذه الحزمة مخصصة لملف تعريف (Profile) الخاص بـ DeepSeek Harness، حيث تضيف مهارة يمكن استدعاؤها بواسطة الذكاء الاصطناعي تسمى: **`create-dsh-plugin`**.

تعتبر هذه المهارة "دليل عمل" (Playbook) لإنشاء إضافات دائمة في DSH، مثل: مدخلات في القائمة الجانبية اليسرى، زخارف لواجهة المستخدم، أدوات أو خدمات في المضيف (Host)، أو صفوف MCP. وتتضمن المهارة عمليات التحقق من الصحة (Validation)، التثبيت المباشر في الملف الشخصي، وإعادة تكوين الحزم المعدلة لضمان عملها بشكل صحيح.

---

## 🚀 Installation / التركيب

### 🤖 Using AI (via DSH Tool) / باستخدام الذكاء الاصطناعي
If you have a session open, you can ask the agent to install it by providing the path to this folder:
إذا كان لديك جلسة مفتوحة، يمكنك طلب التثبيت من العميل (Agent) عبر تزويده بمسار المجلد:

**Prompt Example / مثال على الطلب:**
> "Please install the plugin bundle located at `[Absolute Path to this Folder]` using the `plugin_manager` tool."
> "من فضلك قم بتثبيت حزمة الإضافة الموجودة في المسار `[المسار المطلق لهذا المجلد]` باستخدام أداة `plugin_manager`."

**Technical Command / الأمر التقني:**
```javascript
plugin_manager install_bundle { target: "<absolute path to this directory>" }
```

### 🛠️ Manual Installation / التركيب اليدوي
1. Clone or download this repository to your local machine.
   قم بتحميل أو نسخ هذا المستودع على جهازك.
2. Use the `plugin_manager` tool within DeepSeek Harness to install the bundle by pointing it to the folder containing `package.json`.
   استخدم أداة `plugin_manager` داخل DeepSeek Harness لتثبيت الحزمة عن طريق توجيهها إلى المجلد الذي يحتوي على ملف `package.json`.

---

## 📖 How to Use / طريقة الاستخدام

Once installed, the skill `create-dsh-plugin` becomes available in the agent's skill catalog.

بمجرد التثبيت، تصبح المهارة `create-dsh-plugin` متاحة في دليل مهارات العميل.

### 1. Invoking the Skill / استدعاء المهارة
You can load the skill explicitly in any session:
يمكنك تحميل المهارة بشكل صريح في أي جلسة:

```javascript
skill { name: "create-dsh-plugin" }
```

### 2. Building a Plugin / بناء إضافة
After loading the skill, you can ask the AI to:
بعد تحميل المهارة، يمكنك طلب الآتي من الذكاء الاصطناعي:
- **Create a new tool:** "Create a DSH host tool that calculates X."
  **إنشاء أداة جديدة:** "قم بإنشاء أداة مضيف DSH تقوم بحساب X."
- **Add a sidebar item:** "Add a new entry to the left sidebar for my project."
  **إضافة عنصر للقائمة الجانبية:** "أضف مدخلاً جديداً للقائمة الجانبية اليسرى لمشروعي."
- **Validate a bundle:** "Check if my plugin bundle is valid."
  **التحقق من الحزمة:** "تحقق مما إذا كانت حزمة الإضافة الخاصة بي صالحة."

---

## 📂 Project Structure / هيكل المشروع

| Path | Role / الدور |
|---|---|
| `index.js` | Host provider plugin: registers the skill. / إضافة مزود المضيف: تقوم بتسجيل المهارة. |
| `cordis.patch.yml` | Loader patch that inserts the provider row. / رقعة التحميل التي تدرج صف المزود. |
| `assets/create-dsh-plugin/SKILL.md` | The skill body loaded by the `skill` tool. / محتوى المهارة الذي يتم تحميله بواسطة أداة `skill`. |
| `assets/create-dsh-plugin/references/` | Bundle format and packaging guides. / أدلة تنسيق الحزم والتغليف. |
| `assets/create-dsh-plugin/scripts/` | Validation and smoke test scripts. / سكربتات التحقق واختبارات التشغيل الأولية. |
| `locale/en.json`, `locale/ar.json` | Display metadata (English/Arabic). / بيانات العرض (إنجليزي/عربي). |
| `icon.svg` | Plugin Manager artwork. / أيقونة الإضافة. |

---

## 🔍 Verification / التحقق

To ensure everything is working correctly, you can run:
للتأكد من أن كل شيء يعمل بشكل صحيح، يمكنك تشغيل:

```bash
node assets/create-dsh-plugin/scripts/check-bundle.mjs .
```

Then confirm the live row with `cordis_inspect_query` host `Config.listConfigs` filtered by `name: "dsh-plugin-builder-skill"`.
ثم قم بتأكيد الصف المباشر باستخدام `cordis_inspect_query` للمضيف `Config.listConfigs` مع تصفية الاسم `dsh-plugin-builder-skill`.
