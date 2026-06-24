const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, 'frontend', 'src', 'i18n', 'locales');

const additionalKeys = {
  fr: {
    "reset_password": {
      "title": "Nouveau mot de passe",
      "invalid_token": "Ce lien de réinitialisation est invalide ou a expiré.",
      "request_new": "Demander un nouveau lien",
      "success": "Mot de passe réinitialisé avec succès. Redirection vers la connexion...",
      "password_label": "Nouveau mot de passe",
      "confirm_label": "Confirmer le mot de passe",
      "submit": "Réinitialiser le mot de passe",
      "saving": "Enregistrement...",
      "error_mismatch": "Les mots de passe ne correspondent pas.",
      "error_length": "Le mot de passe doit contenir au moins 6 caractères.",
      "error_generic": "Erreur lors de la réinitialisation."
    },
    "users": {
      "title": "Utilisateurs",
      "load_error": "Erreur lors du chargement des utilisateurs.",
      "status_active_success": "Compte activé avec succès.",
      "status_inactive_success": "Compte désactivé avec succès.",
      "status_pending_success": "Compte mis en attente avec succès.",
      "status_error": "Erreur lors de la mise à jour du statut.",
      "delete_success": "Utilisateur supprimé.",
      "delete_error": "Erreur lors de la suppression.",
      "reset_confirm": "Réinitialiser le mot de passe de {{name}} ?",
      "reset_error": "Erreur lors de la réinitialisation.",
      "action_validate": "Valider",
      "action_deactivate": "Désactiver",
      "action_reactivate": "Réactiver",
      "action_edit": "Modifier",
      "action_reset_pwd": "Réinitialiser mot de passe",
      "action_delete": "Supprimer",
      "modal_delete_title": "Confirmer la suppression",
      "modal_delete_desc": "Voulez-vous vraiment supprimer l'utilisateur",
      "modal_delete_warning": "? Cette action est irréversible.",
      "modal_cancel": "Annuler",
      "stats_total": "Total utilisateurs",
      "stats_total_desc": "Tous les comptes",
      "stats_admins": "Administrateurs",
      "stats_admins_desc": "Comptes avec privilèges Admin",
      "stats_pending": "En attente",
      "stats_pending_desc": "Comptes à valider",
      "stats_inactive": "Inactifs",
      "stats_inactive_desc": "Comptes désactivés",
      "list_title": "Liste des utilisateurs",
      "add_user": "Ajouter un utilisateur",
      "loading": "Chargement...",
      "empty": "Aucun utilisateur trouvé.",
      "col_id": "ID",
      "col_username": "Nom d'utilisateur",
      "col_email": "Email",
      "col_role": "Rôle",
      "col_status": "Statut",
      "col_actions": "Actions",
      "footer": "Gestion des accès et des rôles ITSM",
      "status_active": "Actif",
      "status_pending_label": "En attente",
      "status_inactive_label": "Inactif"
    },
    "tickets": {
      "list": {
        "title": "Tickets",
        "subtitle": {
          "Admin": "Gestion globale de tous les tickets.",
          "Technicien": "Tickets qui vous sont assignés ou non assignés.",
          "Agent": "Vos tickets."
        },
        "new_ticket": "Nouveau ticket",
        "search_placeholder": "Rechercher un ticket...",
        "table_title": "Liste des tickets",
        "empty": "Aucun ticket trouvé.",
        "empty_agent": "Vous n'avez aucun ticket.",
        "no_match": "Aucun ticket ne correspond à votre recherche.",
        "load_error": "Erreur lors du chargement des tickets."
      },
      "stats": {
        "total": "Total",
        "unassigned": "Non assignés",
        "in_progress": "En cours",
        "resolved": "Résolus"
      },
      "filters": {
        "all_statuses": "Tous les statuts",
        "all_priorities": "Toutes les priorités"
      },
      "fields": {
        "title": "Titre",
        "status": "Statut",
        "priority": "Priorité",
        "category": "Catégorie",
        "created_by": "Créé par",
        "assigned_to": "Assigné à",
        "created_at": "Date de création",
        "title_required": "Titre *",
        "description_required": "Description *"
      },
      "status": {
        "Nouveau": "Nouveau",
        "Assigné": "Assigné",
        "En cours": "En cours",
        "En attente": "En attente",
        "Résolu": "Résolu",
        "Clôturé": "Clôturé",
        "Rouvert": "Rouvert"
      },
      "priority": {
        "Haute": "Haute",
        "Moyenne": "Moyenne",
        "Basse": "Basse"
      },
      "priority_with_sla": {
        "Haute": "Haute (SLA: 4h)",
        "Moyenne": "Moyenne (SLA: 24h)",
        "Basse": "Basse (SLA: 72h)"
      },
      "category": {
        "Matériel": "Matériel",
        "Logiciel": "Logiciel",
        "Réseau": "Réseau",
        "Accès / Droits": "Accès / Droits",
        "Imprimante": "Imprimante",
        "Autre": "Autre"
      },
      "form": {
        "new_title": "Nouveau ticket",
        "title_placeholder": "Ex: Problème d'imprimante...",
        "related_asset": "Actif concerné (Optionnel)",
        "no_asset": "Aucun actif",
        "assigned_to_user": "Assigné à {{user}}",
        "description_placeholder": "Décrivez votre problème en détail...",
        "creating": "Création...",
        "create": "Créer le ticket",
        "create_success": "Ticket créé avec succès.",
        "load_error": "Erreur lors du chargement du ticket.",
        "agent_only": "Seul un Agent peut créer un ticket.",
        "creation_reserved": "La création de tickets est réservée aux utilisateurs ayant le rôle 'Agent'."
      },
      "common": {
        "unassigned": "Non assigné"
      }
    },
    "common": {
      "notification": "Notification",
      "generic_error": "Une erreur est survenue.",
      "select": "Sélectionner...",
      "cancel": "Annuler",
      "reset": "Réinitialiser",
      "view": "Voir",
      "results_count": "{{count}} résultat(s)"
    }
  },
  en: {
    "reset_password": {
      "title": "New Password",
      "invalid_token": "This reset link is invalid or has expired.",
      "request_new": "Request a new link",
      "success": "Password reset successfully. Redirecting to login...",
      "password_label": "New Password",
      "confirm_label": "Confirm Password",
      "submit": "Reset Password",
      "saving": "Saving...",
      "error_mismatch": "Passwords do not match.",
      "error_length": "Password must be at least 6 characters long.",
      "error_generic": "Error during reset."
    },
    "users": {
      "title": "Users",
      "load_error": "Error loading users.",
      "status_active_success": "Account successfully activated.",
      "status_inactive_success": "Account successfully deactivated.",
      "status_pending_success": "Account successfully set to pending.",
      "status_error": "Error updating status.",
      "delete_success": "User deleted.",
      "delete_error": "Error during deletion.",
      "reset_confirm": "Reset password for {{name}}?",
      "reset_error": "Error during password reset.",
      "action_validate": "Validate",
      "action_deactivate": "Deactivate",
      "action_reactivate": "Reactivate",
      "action_edit": "Edit",
      "action_reset_pwd": "Reset Password",
      "action_delete": "Delete",
      "modal_delete_title": "Confirm Deletion",
      "modal_delete_desc": "Are you sure you want to delete user",
      "modal_delete_warning": "? This action is irreversible.",
      "modal_cancel": "Cancel",
      "stats_total": "Total Users",
      "stats_total_desc": "All accounts",
      "stats_admins": "Administrators",
      "stats_admins_desc": "Accounts with Admin privileges",
      "stats_pending": "Pending",
      "stats_pending_desc": "Accounts to validate",
      "stats_inactive": "Inactive",
      "stats_inactive_desc": "Deactivated accounts",
      "list_title": "User List",
      "add_user": "Add User",
      "loading": "Loading...",
      "empty": "No users found.",
      "col_id": "ID",
      "col_username": "Username",
      "col_email": "Email",
      "col_role": "Role",
      "col_status": "Status",
      "col_actions": "Actions",
      "footer": "ITSM access and role management",
      "status_active": "Active",
      "status_pending_label": "Pending",
      "status_inactive_label": "Inactive"
    },
    "tickets": {
      "list": {
        "title": "Tickets",
        "subtitle": {
          "Admin": "Global management of all tickets.",
          "Technicien": "Tickets assigned to you or unassigned.",
          "Agent": "Your tickets."
        },
        "new_ticket": "New Ticket",
        "search_placeholder": "Search for a ticket...",
        "table_title": "Ticket List",
        "empty": "No tickets found.",
        "empty_agent": "You have no tickets.",
        "no_match": "No ticket matches your search.",
        "load_error": "Error loading tickets."
      },
      "stats": {
        "total": "Total",
        "unassigned": "Unassigned",
        "in_progress": "In Progress",
        "resolved": "Resolved"
      },
      "filters": {
        "all_statuses": "All Statuses",
        "all_priorities": "All Priorities"
      },
      "fields": {
        "title": "Title",
        "status": "Status",
        "priority": "Priority",
        "category": "Category",
        "created_by": "Created By",
        "assigned_to": "Assigned To",
        "created_at": "Creation Date",
        "title_required": "Title *",
        "description_required": "Description *"
      },
      "status": {
        "Nouveau": "New",
        "Assigné": "Assigned",
        "En cours": "In Progress",
        "En attente": "Pending",
        "Résolu": "Resolved",
        "Clôturé": "Closed",
        "Rouvert": "Reopened"
      },
      "priority": {
        "Haute": "High",
        "Moyenne": "Medium",
        "Basse": "Low"
      },
      "priority_with_sla": {
        "Haute": "High (SLA: 4h)",
        "Moyenne": "Medium (SLA: 24h)",
        "Basse": "Low (SLA: 72h)"
      },
      "category": {
        "Matériel": "Hardware",
        "Logiciel": "Software",
        "Réseau": "Network",
        "Accès / Droits": "Access / Rights",
        "Imprimante": "Printer",
        "Autre": "Other"
      },
      "form": {
        "new_title": "New Ticket",
        "title_placeholder": "Ex: Printer issue...",
        "related_asset": "Related Asset (Optional)",
        "no_asset": "No asset",
        "assigned_to_user": "Assigned to {{user}}",
        "description_placeholder": "Describe your issue in detail...",
        "creating": "Creating...",
        "create": "Create Ticket",
        "create_success": "Ticket created successfully.",
        "load_error": "Error loading ticket.",
        "agent_only": "Only an Agent can create a ticket.",
        "creation_reserved": "Ticket creation is reserved for users with the 'Agent' role."
      },
      "common": {
        "unassigned": "Unassigned"
      }
    },
    "common": {
      "notification": "Notification",
      "generic_error": "An error occurred.",
      "select": "Select...",
      "cancel": "Cancel",
      "reset": "Reset",
      "view": "View",
      "results_count": "{{count}} result(s)"
    }
  },
  ar: {
    "reset_password": {
      "title": "كلمة مرور جديدة",
      "invalid_token": "رابط إعادة التعيين هذا غير صالح أو منتهي الصلاحية.",
      "request_new": "طلب رابط جديد",
      "success": "تمت إعادة تعيين كلمة المرور بنجاح. جاري التوجيه إلى تسجيل الدخول...",
      "password_label": "كلمة المرور الجديدة",
      "confirm_label": "تأكيد كلمة المرور",
      "submit": "إعادة تعيين كلمة المرور",
      "saving": "جاري الحفظ...",
      "error_mismatch": "كلمتا المرور غير متطابقتين.",
      "error_length": "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.",
      "error_generic": "خطأ أثناء إعادة التعيين."
    },
    "users": {
      "title": "المستخدمون",
      "load_error": "خطأ في تحميل المستخدمين.",
      "status_active_success": "تم تفعيل الحساب بنجاح.",
      "status_inactive_success": "تم تعطيل الحساب بنجاح.",
      "status_pending_success": "تم وضع الحساب قيد الانتظار بنجاح.",
      "status_error": "خطأ في تحديث الحالة.",
      "delete_success": "تم حذف المستخدم.",
      "delete_error": "خطأ أثناء الحذف.",
      "reset_confirm": "إعادة تعيين كلمة مرور {{name}}؟",
      "reset_error": "خطأ أثناء إعادة التعيين.",
      "action_validate": "تحقق",
      "action_deactivate": "تعطيل",
      "action_reactivate": "إعادة تفعيل",
      "action_edit": "تعديل",
      "action_reset_pwd": "إعادة تعيين كلمة المرور",
      "action_delete": "حذف",
      "modal_delete_title": "تأكيد الحذف",
      "modal_delete_desc": "هل أنت متأكد أنك تريد حذف المستخدم",
      "modal_delete_warning": "؟ هذا الإجراء لا رجعة فيه.",
      "modal_cancel": "إلغاء",
      "stats_total": "إجمالي المستخدمين",
      "stats_total_desc": "جميع الحسابات",
      "stats_admins": "المسؤولون",
      "stats_admins_desc": "حسابات بصلاحيات مسؤول",
      "stats_pending": "قيد الانتظار",
      "stats_pending_desc": "حسابات للتحقق",
      "stats_inactive": "غير نشط",
      "stats_inactive_desc": "حسابات معطلة",
      "list_title": "قائمة المستخدمين",
      "add_user": "إضافة مستخدم",
      "loading": "جاري التحميل...",
      "empty": "لم يتم العثور على مستخدمين.",
      "col_id": "المعرف",
      "col_username": "اسم المستخدم",
      "col_email": "البريد الإلكتروني",
      "col_role": "الدور",
      "col_status": "الحالة",
      "col_actions": "الإجراءات",
      "footer": "إدارة الوصول والأدوار ITSM",
      "status_active": "نشط",
      "status_pending_label": "قيد الانتظار",
      "status_inactive_label": "غير نشط"
    },
    "tickets": {
      "list": {
        "title": "التذاكر",
        "subtitle": {
          "Admin": "الإدارة الشاملة لجميع التذاكر.",
          "Technicien": "التذاكر المخصصة لك أو غير المخصصة.",
          "Agent": "تذاكرك."
        },
        "new_ticket": "تذكرة جديدة",
        "search_placeholder": "ابحث عن تذكرة...",
        "table_title": "قائمة التذاكر",
        "empty": "لم يتم العثور على تذاكر.",
        "empty_agent": "ليس لديك أي تذاكر.",
        "no_match": "لا توجد تذكرة تطابق بحثك.",
        "load_error": "خطأ في تحميل التذاكر."
      },
      "stats": {
        "total": "الإجمالي",
        "unassigned": "غير مخصص",
        "in_progress": "قيد التقدم",
        "resolved": "تم الحل"
      },
      "filters": {
        "all_statuses": "جميع الحالات",
        "all_priorities": "جميع الأولويات"
      },
      "fields": {
        "title": "العنوان",
        "status": "الحالة",
        "priority": "الأولوية",
        "category": "الفئة",
        "created_by": "تم الإنشاء بواسطة",
        "assigned_to": "مخصص لـ",
        "created_at": "تاريخ الإنشاء",
        "title_required": "العنوان *",
        "description_required": "الوصف *"
      },
      "status": {
        "Nouveau": "جديد",
        "Assigné": "مخصص",
        "En cours": "قيد التقدم",
        "En attente": "قيد الانتظار",
        "Résolu": "تم الحل",
        "Clôturé": "مغلق",
        "Rouvert": "أعيد فتحه"
      },
      "priority": {
        "Haute": "عالية",
        "Moyenne": "متوسطة",
        "Basse": "منخفضة"
      },
      "priority_with_sla": {
        "Haute": "عالية (SLA: 4h)",
        "Moyenne": "متوسطة (SLA: 24h)",
        "Basse": "منخفضة (SLA: 72h)"
      },
      "category": {
        "Matériel": "أجهزة",
        "Logiciel": "برامج",
        "Réseau": "شبكة",
        "Accès / Droits": "وصول / حقوق",
        "Imprimante": "طابعة",
        "Autre": "أخرى"
      },
      "form": {
        "new_title": "تذكرة جديدة",
        "title_placeholder": "مثال: مشكلة في الطابعة...",
        "related_asset": "الأصل المتعلق (اختياري)",
        "no_asset": "بدون أصل",
        "assigned_to_user": "مخصص لـ {{user}}",
        "description_placeholder": "صف مشكلتك بالتفصيل...",
        "creating": "جاري الإنشاء...",
        "create": "إنشاء التذكرة",
        "create_success": "تم إنشاء التذكرة بنجاح.",
        "load_error": "خطأ في تحميل التذكرة.",
        "agent_only": "وكيل فقط يمكنه إنشاء تذكرة.",
        "creation_reserved": "إنشاء التذاكر محجوز للمستخدمين الذين لديهم دور 'وكيل'."
      },
      "common": {
        "unassigned": "غير مخصص"
      }
    },
    "common": {
      "notification": "إشعار",
      "generic_error": "حدث خطأ.",
      "select": "حدد...",
      "cancel": "إلغاء",
      "reset": "إعادة تعيين",
      "view": "عرض",
      "results_count": "{{count}} نتيجة"
    }
  }
};

['fr', 'en', 'ar'].forEach(lang => {
  const filePath = path.join(localesPath, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const updatedContent = { ...content, ...additionalKeys[lang] };
  fs.writeFileSync(filePath, JSON.stringify(updatedContent, null, 2));
  console.log(`Updated ${lang}.json`);
});
