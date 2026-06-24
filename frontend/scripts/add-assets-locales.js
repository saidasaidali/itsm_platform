const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, 'frontend', 'src', 'i18n', 'locales');

const additionalKeys = {
  fr: {
    "assets": {
      "status": {
        "En service": "En service",
        "En panne": "En panne",
        "En maintenance": "En maintenance",
        "Retiré": "Retiré"
      },
      "type": {
        "Ordinateur portable": "Ordinateur portable",
        "Ordinateur fixe": "Ordinateur fixe",
        "Imprimante": "Imprimante",
        "Écran": "Écran",
        "Téléphone": "Téléphone",
        "Switch": "Switch",
        "Serveur": "Serveur",
        "Autre": "Autre"
      },
      "alerts": {
        "warranty_count": "{{count}} garantie(s) expire(nt) bientôt",
        "warranty_text": "Ces équipements nécessitent une attention particulière :",
        "days_short": "{{count}} jours restants",
        "reliability_count": "{{count}} équipement(s) avec des pannes fréquentes",
        "reliability_text": "Plus de 2 pannes dans les 6 derniers mois :",
        "failures": "{{count}} pannes"
      },
      "list": {
        "title": "Parc informatique",
        "total": "{{count}} équipements au total",
        "add": "Ajouter un équipement",
        "search_placeholder": "Rechercher un équipement...",
        "table_title": "Liste des équipements",
        "empty": "Aucun équipement trouvé.",
        "no_match": "Aucun équipement ne correspond à votre recherche."
      },
      "filters": {
        "all_statuses": "Tous les statuts"
      },
      "fields": {
        "tag": "Tag",
        "type": "Type",
        "brand_model": "Marque / Modèle",
        "status": "Statut",
        "assigned_to": "Assigné à",
        "department": "Département",
        "warranty": "Garantie",
        "asset_tag_required": "Tag de l'équipement *",
        "serial_number": "Numéro de série",
        "type_required": "Type *",
        "brand_required": "Marque *",
        "model_required": "Modèle *",
        "location": "Localisation",
        "assigned_user": "Utilisateur assigné",
        "department_service": "Département / Service",
        "office": "Bureau",
        "purchase_date": "Date d'achat",
        "warranty_end": "Fin de garantie"
      },
      "warranty": {
        "expired_days": "Expiré depuis {{count}} j",
        "days": "{{count}} jours restants"
      },
      "common": {
        "asset": "Équipement",
        "unassigned": "Non assigné"
      },
      "form": {
        "load_error": "Erreur lors du chargement de l'équipement.",
        "update_success": "Équipement mis à jour avec succès.",
        "create_success": "Équipement créé avec succès.",
        "save_error": "Erreur lors de l'enregistrement de l'équipement.",
        "edit_title": "Modifier l'équipement",
        "add_title": "Ajouter un équipement",
        "location_placeholder": "Ex: Salle serveur, Bureau 12...",
        "department_placeholder": "Ex: Ressources Humaines...",
        "office_placeholder": "Ex: Bâtiment A, Étage 2...",
        "update": "Enregistrer",
        "create": "Créer l'équipement"
      },
      "sections": {
        "identification": "Identification",
        "assignment": "Assignation",
        "warranty_purchase": "Achat & Garantie"
      }
    }
  },
  en: {
    "assets": {
      "status": {
        "En service": "In Service",
        "En panne": "Broken",
        "En maintenance": "In Maintenance",
        "Retiré": "Retired"
      },
      "type": {
        "Ordinateur portable": "Laptop",
        "Ordinateur fixe": "Desktop",
        "Imprimante": "Printer",
        "Écran": "Monitor",
        "Téléphone": "Phone",
        "Switch": "Switch",
        "Serveur": "Server",
        "Autre": "Other"
      },
      "alerts": {
        "warranty_count": "{{count}} warranty(ies) expiring soon",
        "warranty_text": "These assets require attention:",
        "days_short": "{{count}} days left",
        "reliability_count": "{{count}} asset(s) with frequent failures",
        "reliability_text": "More than 2 failures in the last 6 months:",
        "failures": "{{count}} failures"
      },
      "list": {
        "title": "IT Assets",
        "total": "{{count}} total assets",
        "add": "Add an Asset",
        "search_placeholder": "Search an asset...",
        "table_title": "Asset List",
        "empty": "No assets found.",
        "no_match": "No asset matches your search."
      },
      "filters": {
        "all_statuses": "All Statuses"
      },
      "fields": {
        "tag": "Asset Tag",
        "type": "Type",
        "brand_model": "Brand / Model",
        "status": "Status",
        "assigned_to": "Assigned To",
        "department": "Department",
        "warranty": "Warranty",
        "asset_tag_required": "Asset Tag *",
        "serial_number": "Serial Number",
        "type_required": "Type *",
        "brand_required": "Brand *",
        "model_required": "Model *",
        "location": "Location",
        "assigned_user": "Assigned User",
        "department_service": "Department / Service",
        "office": "Office",
        "purchase_date": "Purchase Date",
        "warranty_end": "Warranty End"
      },
      "warranty": {
        "expired_days": "Expired {{count}} days ago",
        "days": "{{count}} days left"
      },
      "common": {
        "asset": "Asset",
        "unassigned": "Unassigned"
      },
      "form": {
        "load_error": "Error loading asset.",
        "update_success": "Asset updated successfully.",
        "create_success": "Asset created successfully.",
        "save_error": "Error saving asset.",
        "edit_title": "Edit Asset",
        "add_title": "Add an Asset",
        "location_placeholder": "Ex: Server Room, Office 12...",
        "department_placeholder": "Ex: Human Resources...",
        "office_placeholder": "Ex: Building A, Floor 2...",
        "update": "Save",
        "create": "Create Asset"
      },
      "sections": {
        "identification": "Identification",
        "assignment": "Assignment",
        "warranty_purchase": "Purchase & Warranty"
      }
    }
  },
  ar: {
    "assets": {
      "status": {
        "En service": "في الخدمة",
        "En panne": "معطل",
        "En maintenance": "في الصيانة",
        "Retiré": "مسحوب"
      },
      "type": {
        "Ordinateur portable": "حاسوب محمول",
        "Ordinateur fixe": "حاسوب مكتبي",
        "Imprimante": "طابعة",
        "Écran": "شاشة",
        "Téléphone": "هاتف",
        "Switch": "موزع",
        "Serveur": "خادم",
        "Autre": "أخرى"
      },
      "alerts": {
        "warranty_count": "{{count}} ضمانات تنتهي قريبًا",
        "warranty_text": "تتطلب هذه المعدات الانتباه:",
        "days_short": "متبقي {{count}} أيام",
        "reliability_count": "{{count}} معدات بأعطال متكررة",
        "reliability_text": "أكثر من عطلين في الأشهر الستة الماضية:",
        "failures": "{{count}} أعطال"
      },
      "list": {
        "title": "الموارد التقنية",
        "total": "إجمالي {{count}} معدات",
        "add": "إضافة معدات",
        "search_placeholder": "ابحث عن معدات...",
        "table_title": "قائمة المعدات",
        "empty": "لم يتم العثور على معدات.",
        "no_match": "لا توجد معدات تطابق بحثك."
      },
      "filters": {
        "all_statuses": "جميع الحالات"
      },
      "fields": {
        "tag": "علامة",
        "type": "النوع",
        "brand_model": "الماركة / الموديل",
        "status": "الحالة",
        "assigned_to": "مخصص لـ",
        "department": "القسم",
        "warranty": "الضمان",
        "asset_tag_required": "علامة المعدات *",
        "serial_number": "الرقم التسلسلي",
        "type_required": "النوع *",
        "brand_required": "الماركة *",
        "model_required": "الموديل *",
        "location": "الموقع",
        "assigned_user": "المستخدم المخصص",
        "department_service": "القسم / الخدمة",
        "office": "المكتب",
        "purchase_date": "تاريخ الشراء",
        "warranty_end": "نهاية الضمان"
      },
      "warranty": {
        "expired_days": "منتهية منذ {{count}} أيام",
        "days": "متبقي {{count}} أيام"
      },
      "common": {
        "asset": "معدات",
        "unassigned": "غير مخصص"
      },
      "form": {
        "load_error": "خطأ في تحميل المعدات.",
        "update_success": "تم تحديث المعدات بنجاح.",
        "create_success": "تم إنشاء المعدات بنجاح.",
        "save_error": "خطأ في حفظ المعدات.",
        "edit_title": "تعديل المعدات",
        "add_title": "إضافة معدات",
        "location_placeholder": "مثال: غرفة الخوادم، مكتب 12...",
        "department_placeholder": "مثال: الموارد البشرية...",
        "office_placeholder": "مثال: مبنى أ، الطابق الثاني...",
        "update": "حفظ",
        "create": "إنشاء المعدات"
      },
      "sections": {
        "identification": "التعريف",
        "assignment": "التخصيص",
        "warranty_purchase": "الشراء والضمان"
      }
    }
  }
};

['fr', 'en', 'ar'].forEach(lang => {
  const filePath = path.join(localesPath, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const updatedContent = { ...content, assets: { ...content.assets, ...additionalKeys[lang].assets } };
  fs.writeFileSync(filePath, JSON.stringify(updatedContent, null, 2));
  console.log(`Updated ${lang}.json for assets`);
});
