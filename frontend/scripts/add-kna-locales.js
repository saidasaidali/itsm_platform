const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, 'frontend', 'src', 'i18n', 'locales');

const additionalKeys = {
  fr: {
    "knowledge": {
      "title": "Base de connaissances",
      "available_articles": "{{count}} article(s) disponible(s)",
      "new_article": "Nouvel article",
      "search_placeholder": "Rechercher par titre, résumé ou mot-clé...",
      "empty_published": "Aucun article publié pour le moment.",
      "empty_search": "Aucun article ne correspond à votre recherche.",
      "category": {
        "Tous": "Tous",
        "Procédures": "Procédures",
        "Solutions techniques": "Solutions techniques",
        "FAQ": "FAQ",
        "Documentation matériel": "Documentation matériel"
      },
      "form": {
        "load_error": "Erreur lors du chargement.",
        "not_allowed": "Réservé aux techniciens et administrateurs.",
        "update_success": "Article mis à jour.",
        "create_success": "Article publié.",
        "save_error": "Erreur lors de l'enregistrement.",
        "edit_title": "Modifier l'article",
        "add_title": "Nouvel article",
        "title_label": "Titre *",
        "title_placeholder": "Titre de l'article...",
        "category_label": "Catégorie *",
        "summary_label": "Résumé *",
        "summary_placeholder": "Résumé court affiché dans la liste...",
        "content_label": "Contenu *",
        "content_placeholder": "Rédigez votre article ici...",
        "keywords_label": "Mots-clés",
        "keywords_hint": "(Entrée ou virgule pour valider)",
        "keywords_placeholder": "vpn, mot de passe, réseau...",
        "publishing": "Publication...",
        "update_btn": "Mettre à jour",
        "publish_btn": "Publier l'article",
        "cancel_btn": "Annuler"
      }
    },
    "notifications": {
      "title": "Notifications",
      "unread_count": "{{count}} non lue(s)",
      "preferences_btn": "Préférences",
      "mark_all_read": "Tout marquer lu",
      "my_notifications": "Mes notifications ({{count}})",
      "empty": "Aucune notification pour le moment.",
      "new_badge": "Nouveau",
      "ticket_badge": "Ticket #{{id}}",
      "asset_badge": "Équipement #{{id}}",
      "mark_read_title": "Marquer comme lu",
      "delete_title": "Supprimer",
      "prefs_saved": "Préférences sauvegardées.",
      "prefs_modal_title": "Préférences de notification",
      "prefs_desc": "Choisissez les événements pour lesquels vous souhaitez recevoir des notifications.",
      "prefs_saving": "Sauvegarde...",
      "prefs_save": "Sauvegarder",
      "prefs_cancel": "Annuler",
      "labels": {
        "email_ticket_created": "Création de ticket",
        "email_status_change": "Changement de statut",
        "email_assigned": "Affectation de ticket",
        "email_comment": "Nouveau commentaire",
        "email_sla_breach": "Dépassement SLA",
        "email_closed": "Clôture de ticket",
        "web_notifications": "Notifications dans l'interface"
      }
    },
    "anomalies": {
      "title": "Détection d'anomalies",
      "stats_critical": "Critiques",
      "stats_high": "Élevées",
      "stats_open": "Total ouvertes",
      "stats_last24h": "Dernières 24h",
      "unknown_alert": "{{count}} appareil(s) inconnu(s)",
      "unknown_alert_desc": "détecté(s) sur le réseau, non répertoriés dans l'inventaire.",
      "unknown_seen": "vu {{count}} fois",
      "unknown_no_name": "Sans nom",
      "filters": {
        "open": "Ouvertes",
        "acknowledged": "Prises en compte",
        "resolved": "Résolues",
        "ignored": "Ignorées",
        "all": "Toutes"
      },
      "list_title": "Anomalies ({{count}})",
      "empty": "Aucune anomalie pour ce filtre.",
      "detected_on": "Détecté le {{date}}",
      "resolved_by": "Traité par {{name}}",
      "action_seen": "Vu",
      "action_resolved": "Résolu",
      "action_ignored": "Ignorer",
      "severity": {
        "critical": "Critique",
        "high": "Élevée",
        "medium": "Moyenne",
        "low": "Faible"
      }
    }
  },
  en: {
    "knowledge": {
      "title": "Knowledge Base",
      "available_articles": "{{count}} available article(s)",
      "new_article": "New article",
      "search_placeholder": "Search by title, summary or keyword...",
      "empty_published": "No articles published yet.",
      "empty_search": "No article matches your search.",
      "category": {
        "Tous": "All",
        "Procédures": "Procedures",
        "Solutions techniques": "Technical solutions",
        "FAQ": "FAQ",
        "Documentation matériel": "Hardware documentation"
      },
      "form": {
        "load_error": "Error loading article.",
        "not_allowed": "Restricted to technicians and administrators.",
        "update_success": "Article updated.",
        "create_success": "Article published.",
        "save_error": "Error saving article.",
        "edit_title": "Edit article",
        "add_title": "New article",
        "title_label": "Title *",
        "title_placeholder": "Article title...",
        "category_label": "Category *",
        "summary_label": "Summary *",
        "summary_placeholder": "Short summary shown in list...",
        "content_label": "Content *",
        "content_placeholder": "Write your article here...",
        "keywords_label": "Keywords",
        "keywords_hint": "(Enter or comma to confirm)",
        "keywords_placeholder": "vpn, password, network...",
        "publishing": "Publishing...",
        "update_btn": "Update",
        "publish_btn": "Publish article",
        "cancel_btn": "Cancel"
      }
    },
    "notifications": {
      "title": "Notifications",
      "unread_count": "{{count}} unread",
      "preferences_btn": "Preferences",
      "mark_all_read": "Mark all as read",
      "my_notifications": "My notifications ({{count}})",
      "empty": "No notifications yet.",
      "new_badge": "New",
      "ticket_badge": "Ticket #{{id}}",
      "asset_badge": "Asset #{{id}}",
      "mark_read_title": "Mark as read",
      "delete_title": "Delete",
      "prefs_saved": "Preferences saved.",
      "prefs_modal_title": "Notification Preferences",
      "prefs_desc": "Choose the events for which you want to receive notifications.",
      "prefs_saving": "Saving...",
      "prefs_save": "Save",
      "prefs_cancel": "Cancel",
      "labels": {
        "email_ticket_created": "Ticket creation",
        "email_status_change": "Status change",
        "email_assigned": "Ticket assignment",
        "email_comment": "New comment",
        "email_sla_breach": "SLA breach",
        "email_closed": "Ticket closure",
        "web_notifications": "In-app notifications"
      }
    },
    "anomalies": {
      "title": "Anomaly Detection",
      "stats_critical": "Critical",
      "stats_high": "High",
      "stats_open": "Total open",
      "stats_last24h": "Last 24h",
      "unknown_alert": "{{count}} unknown device(s)",
      "unknown_alert_desc": "detected on the network, not listed in inventory.",
      "unknown_seen": "seen {{count}} times",
      "unknown_no_name": "No name",
      "filters": {
        "open": "Open",
        "acknowledged": "Acknowledged",
        "resolved": "Resolved",
        "ignored": "Ignored",
        "all": "All"
      },
      "list_title": "Anomalies ({{count}})",
      "empty": "No anomalies for this filter.",
      "detected_on": "Detected on {{date}}",
      "resolved_by": "Handled by {{name}}",
      "action_seen": "Ack",
      "action_resolved": "Resolve",
      "action_ignored": "Ignore",
      "severity": {
        "critical": "Critical",
        "high": "High",
        "medium": "Medium",
        "low": "Low"
      }
    }
  },
  ar: {
    "knowledge": {
      "title": "قاعدة المعرفة",
      "available_articles": "{{count}} مقال(متاحة)",
      "new_article": "مقال جديد",
      "search_placeholder": "ابحث بالعنوان، الملخص أو الكلمة الرئيسية...",
      "empty_published": "لم يتم نشر أي مقالات بعد.",
      "empty_search": "لا يوجد مقال يطابق بحثك.",
      "category": {
        "Tous": "الكل",
        "Procédures": "إجراءات",
        "Solutions techniques": "حلول تقنية",
        "FAQ": "الأسئلة الشائعة",
        "Documentation matériel": "وثائق الأجهزة"
      },
      "form": {
        "load_error": "خطأ في التحميل.",
        "not_allowed": "مخصص للفنيين والمسؤولين.",
        "update_success": "تم تحديث المقال.",
        "create_success": "تم نشر المقال.",
        "save_error": "خطأ أثناء الحفظ.",
        "edit_title": "تعديل المقال",
        "add_title": "مقال جديد",
        "title_label": "العنوان *",
        "title_placeholder": "عنوان المقال...",
        "category_label": "الفئة *",
        "summary_label": "الملخص *",
        "summary_placeholder": "ملخص قصير معروض في القائمة...",
        "content_label": "المحتوى *",
        "content_placeholder": "اكتب مقالك هنا...",
        "keywords_label": "الكلمات الدالة",
        "keywords_hint": "(اضغط Enter أو الفاصلة للتأكيد)",
        "keywords_placeholder": "vpn, كلمة المرور, الشبكة...",
        "publishing": "جاري النشر...",
        "update_btn": "تحديث",
        "publish_btn": "نشر المقال",
        "cancel_btn": "إلغاء"
      }
    },
    "notifications": {
      "title": "الإشعارات",
      "unread_count": "{{count}} غير مقروءة",
      "preferences_btn": "التفضيلات",
      "mark_all_read": "تحديد الكل كمقروء",
      "my_notifications": "إشعاراتي ({{count}})",
      "empty": "لا توجد إشعارات حتى الآن.",
      "new_badge": "جديد",
      "ticket_badge": "تذكرة #{{id}}",
      "asset_badge": "معدات #{{id}}",
      "mark_read_title": "تحديد كمقروء",
      "delete_title": "حذف",
      "prefs_saved": "تم حفظ التفضيلات.",
      "prefs_modal_title": "تفضيلات الإشعارات",
      "prefs_desc": "اختر الأحداث التي ترغب في تلقي إشعارات بشأنها.",
      "prefs_saving": "جاري الحفظ...",
      "prefs_save": "حفظ",
      "prefs_cancel": "إلغاء",
      "labels": {
        "email_ticket_created": "إنشاء تذكرة",
        "email_status_change": "تغيير الحالة",
        "email_assigned": "تعيين تذكرة",
        "email_comment": "تعليق جديد",
        "email_sla_breach": "تجاوز SLA",
        "email_closed": "إغلاق التذكرة",
        "web_notifications": "إشعارات داخل الواجهة"
      }
    },
    "anomalies": {
      "title": "اكتشاف الحالات الشاذة",
      "stats_critical": "حرجة",
      "stats_high": "عالية",
      "stats_open": "إجمالي المفتوحة",
      "stats_last24h": "آخر 24 ساعة",
      "unknown_alert": "{{count}} جهاز غير معروف",
      "unknown_alert_desc": "تم اكتشافها على الشبكة، غير مدرجة في المخزون.",
      "unknown_seen": "شوهد {{count}} مرات",
      "unknown_no_name": "بدون اسم",
      "filters": {
        "open": "مفتوحة",
        "acknowledged": "تم الإقرار بها",
        "resolved": "تم الحل",
        "ignored": "تجاهل",
        "all": "الكل"
      },
      "list_title": "الحالات الشاذة ({{count}})",
      "empty": "لا توجد حالات شاذة لهذا الفلتر.",
      "detected_on": "تم الاكتشاف في {{date}}",
      "resolved_by": "تمت معالجته بواسطة {{name}}",
      "action_seen": "تمت المشاهدة",
      "action_resolved": "حل",
      "action_ignored": "تجاهل",
      "severity": {
        "critical": "حرج",
        "high": "عالي",
        "medium": "متوسط",
        "low": "منخفض"
      }
    }
  }
};

['fr', 'en', 'ar'].forEach(lang => {
  const filePath = path.join(localesPath, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const updatedContent = { 
    ...content, 
    knowledge: { ...content.knowledge, ...additionalKeys[lang].knowledge },
    notifications: { ...content.notifications, ...additionalKeys[lang].notifications },
    anomalies: { ...content.anomalies, ...additionalKeys[lang].anomalies }
  };
  fs.writeFileSync(filePath, JSON.stringify(updatedContent, null, 2));
  console.log(`Updated ${lang}.json for Knowledge, Notifications, Anomalies`);
});
