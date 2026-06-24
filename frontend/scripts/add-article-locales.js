const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, 'frontend', 'src', 'i18n', 'locales');

const additionalKeys = {
  fr: {
    "article": {
      "not_found": "Article introuvable.",
      "delete_confirm": "Supprimer cet article définitivement ?",
      "delete_error": "Erreur lors de la suppression.",
      "by": "Par",
      "updated_on": "Mis à jour le",
      "views": "vue(s)",
      "back": "Retour",
      "edit": "Modifier",
      "delete": "Supprimer",
      "summary": "Résumé :",
      "keywords": "Mots-clés :"
    }
  },
  en: {
    "article": {
      "not_found": "Article not found.",
      "delete_confirm": "Delete this article permanently?",
      "delete_error": "Error during deletion.",
      "by": "By",
      "updated_on": "Updated on",
      "views": "view(s)",
      "back": "Back",
      "edit": "Edit",
      "delete": "Delete",
      "summary": "Summary:",
      "keywords": "Keywords:"
    }
  },
  ar: {
    "article": {
      "not_found": "المقال غير موجود.",
      "delete_confirm": "هل تريد حذف هذا المقال نهائيًا؟",
      "delete_error": "خطأ أثناء الحذف.",
      "by": "بواسطة",
      "updated_on": "تم التحديث في",
      "views": "مشاهدة(متاح)",
      "back": "رجوع",
      "edit": "تعديل",
      "delete": "حذف",
      "summary": "الملخص:",
      "keywords": "الكلمات الدالة:"
    }
  }
};

['fr', 'en', 'ar'].forEach(lang => {
  const filePath = path.join(localesPath, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const updatedContent = { 
    ...content, 
    article: { ...content.article, ...additionalKeys[lang].article }
  };
  fs.writeFileSync(filePath, JSON.stringify(updatedContent, null, 2));
  console.log(`Updated ${lang}.json for Article`);
});
