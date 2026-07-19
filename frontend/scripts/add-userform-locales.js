const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, 'frontend', 'src', 'i18n', 'locales');

const additionalKeys = {
  fr: {
    form_load_error: "Impossible de charger l'utilisateur.",
    form_update_error: "Impossible de modifier l'utilisateur.",
    form_create_error: "Impossible de créer l'utilisateur.",
    form_edit_title: "Modifier l'utilisateur",
    form_password_edit: "Nouveau mot de passe (laisser vide pour ne pas changer)",
    form_password: "Mot de passe",
    form_password_edit_placeholder: "Laisser vide pour ne pas modifier",
    form_saving: "Enregistrement...",
    form_save_changes: "Enregistrer les modifications",
    form_create_btn: "Créer l'utilisateur"
  },
  en: {
    form_load_error: "Unable to load user.",
    form_update_error: "Unable to update user.",
    form_create_error: "Unable to create user.",
    form_edit_title: "Edit User",
    form_password_edit: "New password (leave blank to keep current)",
    form_password: "Password",
    form_password_edit_placeholder: "Leave blank to keep current",
    form_saving: "Saving...",
    form_save_changes: "Save changes",
    form_create_btn: "Create user"
  },
  ar: {
    form_load_error: "تعذر تحميل المستخدم.",
    form_update_error: "تعذر تعديل المستخدم.",
    form_create_error: "تعذر إنشاء المستخدم.",
    form_edit_title: "تعديل المستخدم",
    form_password_edit: "كلمة المرور الجديدة (اتركه فارغاً لعدم التغيير)",
    form_password: "كلمة المرور",
    form_password_edit_placeholder: "اتركه فارغاً لعدم التغيير",
    form_saving: "جاري الحفظ...",
    form_save_changes: "حفظ التغييرات",
    form_create_btn: "إنشاء مستخدم"
  }
};

['fr', 'en', 'ar'].forEach(lang => {
  const filePath = path.join(localesPath, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  content.users = { ...content.users, ...additionalKeys[lang] };
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  console.log(`Updated ${lang}.json for UserForm`);
});
