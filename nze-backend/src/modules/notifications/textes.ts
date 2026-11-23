// Textes des notifications serveur dans les quatre langues (cahier §23 : interface et messages traduits).
// Règle : la langue est celle du compte du destinataire ; à défaut, le français.
// Les montants, dates et motifs saisis sont passés en paramètres : ils ne sont jamais écrits dans le modèle.
// Les traductions arabe et chinoise doivent être relues par des traducteurs (point O-6 du registre).
export const LANGUES_NOTIFICATION = ['fr', 'en', 'ar', 'zh-Hans'] as const;
export type LangueNotification = (typeof LANGUES_NOTIFICATION)[number];

export type Parametres = Record<string, string | number>;
type Traduction = Record<LangueNotification, (p: Parametres) => string>;
interface Modele { titre: Traduction; message: Traduction }

const fixe = (fr: string, en: string, ar: string, zh: string): Traduction => ({
  fr: () => fr, en: () => en, ar: () => ar, 'zh-Hans': () => zh,
});

const SOLUTIONS: Record<string, Traduction> = {
  REMPLACEMENT: fixe('remplacement de l’article', 'replacement of the item', 'استبدال المنتج', '更换商品'),
};

export const TEXTES: Record<string, Modele> = {
  COLLECTE_A_CONFIRMER: {
    titre: fixe('Article récupéré par NZE', 'Item collected by NZE', 'تم استلام المنتج من قبل NZE', 'NZE 已取回商品'),
    message: fixe(
      'Le livreur a signalé la récupération de vos articles. Confirmez leur remise ou signalez une erreur.',
      'The courier reported collecting your items. Confirm their handover or report an error.',
      'أبلغ المندوب عن استلام منتجاتك. أكّد تسليمها أو أبلغ عن خطأ.',
      '配送员已报告取回您的商品。请确认交接或报告错误。',
    ),
  },
  ANOMALIE_QUALITE: {
    titre: fixe('Anomalie de qualité', 'Quality issue', 'عيب في الجودة', '质量异常'),
    message: fixe(
      'Un article de votre entreprise a une anomalie de qualité. Il est bloqué jusqu’à décision de NZE.',
      'An item from your company has a quality issue. It is blocked until NZE decides.',
      'يوجد عيب في الجودة لمنتج من شركتك. المنتج محجوز إلى حين قرار NZE.',
      '贵公司的一件商品存在质量问题。在 NZE 作出决定前该商品暂停。',
    ),
  },
  COLLECTE_A_VALIDER: {
    titre: fixe('Collecte à valider', 'Collection to validate', 'عملية جمع تنتظر التحقق', '待验证的取件'),
    message: fixe(
      'Le commerçant confirme la remise. La validation définitive est attendue.',
      'The merchant confirms the handover. Final validation is expected.',
      'أكّد التاجر التسليم. مطلوب التحقق النهائي.',
      '商家确认已交接。等待最终验证。',
    ),
  },
  COLLECTE_CONTESTEE: {
    titre: fixe('Collecte contestée', 'Collection disputed', 'عملية الجمع محل اعتراض', '取件被提出异议'),
    message: {
      fr: (p) => `Le commerçant conteste la collecte : ${p.motif}`,
      en: (p) => `The merchant disputes the collection: ${p.motif}`,
      ar: (p) => `يعترض التاجر على عملية الجمع: ${p.motif}`,
      'zh-Hans': (p) => `商家对此次取件提出异议：${p.motif}`,
    },
  },
  'COLLECTE_VALIDEE.partenaire': {
    titre: fixe('Collecte validée par NZE', 'Collection validated by NZE', 'تم التحقق من عملية الجمع من قبل NZE', 'NZE 已验证取件'),
    message: fixe('La collecte est définitivement validée.', 'The collection is finally validated.', 'تم التحقق من عملية الجمع نهائيًا.', '取件已最终验证。'),
  },
  'COLLECTE_REFUSEE.partenaire': {
    titre: fixe('Collecte refusée par NZE', 'Collection refused by NZE', 'رفضت NZE عملية الجمع', 'NZE 拒绝了取件'),
    message: {
      fr: (p) => `La collecte a été refusée : ${p.motif}`,
      en: (p) => `The collection was refused: ${p.motif}`,
      ar: (p) => `تم رفض عملية الجمع: ${p.motif}`,
      'zh-Hans': (p) => `取件已被拒绝：${p.motif}`,
    },
  },
  'COLLECTE_VALIDEE.collecteur': {
    titre: fixe('Collecte validée', 'Collection validated', 'تم التحقق من عملية الجمع', '取件已验证'),
    message: fixe('Votre collecte a été validée définitivement par NZE.', 'Your collection was finally validated by NZE.', 'تم التحقق من عملية جمعك نهائيًا من قبل NZE.', '您的取件已由 NZE 最终验证。'),
  },
  'COLLECTE_REFUSEE.collecteur': {
    titre: fixe('Collecte refusée', 'Collection refused', 'تم رفض عملية الجمع', '取件已被拒绝'),
    message: {
      fr: (p) => `Votre collecte a été refusée : ${p.motif}`,
      en: (p) => `Your collection was refused: ${p.motif}`,
      ar: (p) => `تم رفض عملية جمعك: ${p.motif}`,
      'zh-Hans': (p) => `您的取件已被拒绝：${p.motif}`,
    },
  },
  LIVRAISON_AFFECTEE: {
    titre: fixe('Votre commande est en route', 'Your order is on its way', 'طلبك في الطريق', '您的订单正在配送途中'),
    message: fixe(
      'Un livreur NZE a été affecté à votre commande. Le code de remise est disponible dans le suivi de la commande.',
      'A NZE courier has been assigned to your order. The handover code is available in the order tracking.',
      'تم تعيين مندوب من NZE لطلبك. رمز التسليم متاح في متابعة الطلب.',
      '已为您的订单指派 NZE 配送员。交接代码可在订单跟踪中查看。',
    ),
  },
  LIVRAISON_CONFIRMEE: {
    titre: fixe('Commande livrée', 'Order delivered', 'تم تسليم الطلب', '订单已送达'),
    message: fixe('Votre commande a été remise. Merci de votre confiance.', 'Your order has been handed over. Thank you for your trust.', 'تم تسليم طلبك. شكرًا لثقتك.', '您的订单已交付。感谢您的信任。'),
  },
  LIVRAISON_PARTIELLE: {
    titre: fixe('Livraison partielle', 'Partial delivery', 'تسليم جزئي', '部分送达'),
    message: fixe(
      'Une partie de votre commande a été remise. Le reste sera livré prochainement.',
      'Part of your order has been handed over. The rest will be delivered soon.',
      'تم تسليم جزء من طلبك. وسيتم تسليم الباقي قريبًا.',
      '您的订单已部分交付，其余部分将尽快送达。',
    ),
  },
  LIVRAISON_ECHEC: {
    titre: fixe('Livraison non effectuée', 'Delivery not completed', 'لم يتم التسليم', '未能送达'),
    message: fixe(
      'Votre commande n’a pas pu être remise. NZE vous contactera pour une nouvelle tentative.',
      'Your order could not be handed over. NZE will contact you for a new attempt.',
      'تعذّر تسليم طلبك. ستتصل بك NZE لمحاولة جديدة.',
      '您的订单未能交付。NZE 将与您联系重新配送。',
    ),
  },
  LIVREUR_ARRIVE: {
    titre: fixe('Votre livreur est arrivé', 'Your courier has arrived', 'وصل المندوب', '配送员已到达'),
    message: fixe(
      'Préparez le code de remise affiché dans le suivi de votre commande.',
      'Prepare the handover code shown in your order tracking.',
      'جهّز رمز التسليم المعروض في متابعة طلبك.',
      '请准备好订单跟踪中显示的交接代码。',
    ),
  },
  RECLAMATION_RECUE: {
    titre: fixe('Réclamation enregistrée', 'Claim recorded', 'تم تسجيل الشكوى', '投诉已登记'),
    message: {
      fr: (p) => `NZE examine votre réclamation et vous répond dans un délai de ${p.delai} heures.`,
      en: (p) => `NZE is reviewing your claim and will reply within ${p.delai} hours.`,
      ar: (p) => `تقوم NZE بدراسة شكواك وستردّ خلال ${p.delai} ساعة.`,
      'zh-Hans': (p) => `NZE 正在审核您的投诉，将在 ${p.delai} 小时内答复。`,
    },
  },
  RECLAMATION_ACCEPTEE: {
    titre: fixe('Réclamation acceptée', 'Claim accepted', 'تم قبول الشكوى', '投诉已受理'),
    message: {
      fr: (p) => `NZE vous propose : ${SOLUTIONS[p.solution as string].fr(p)}. Nous vous contactons pour la mise en œuvre.`,
      en: (p) => `NZE offers you: ${SOLUTIONS[p.solution as string].en(p)}. We will contact you to proceed.`,
      ar: (p) => `تقترح عليك NZE: ${SOLUTIONS[p.solution as string].ar(p)}. سنتصل بك لتنفيذ ذلك.`,
      'zh-Hans': (p) => `NZE 为您提供：${SOLUTIONS[p.solution as string]['zh-Hans'](p)}。我们将与您联系安排落实。`,
    },
  },
  RECLAMATION_REFUSEE: {
    titre: fixe('Réclamation non retenue', 'Claim not upheld', 'لم يتم قبول الشكوى', '投诉未获受理'),
    message: {
      fr: (p) => `NZE n’a pas retenu votre réclamation. Motif : ${p.motif}. Contactez NZE pour plus d’informations.`,
      en: (p) => `NZE did not uphold your claim. Reason: ${p.motif}. Contact NZE for more information.`,
      ar: (p) => `لم تقبل NZE شكواك. السبب: ${p.motif}. تواصل مع NZE لمزيد من المعلومات.`,
      'zh-Hans': (p) => `NZE 未受理您的投诉。原因：${p.motif}。如需更多信息，请联系 NZE。`,
    },
  },
  RECLAMATION_CLOTUREE: {
    titre: fixe('Réclamation clôturée', 'Claim closed', 'تم إغلاق الشكوى', '投诉已关闭'),
    message: fixe('Votre réclamation est clôturée. Merci de nous avoir écrit.', 'Your claim is closed. Thank you for writing to us.', 'أُغلقت شكواك. شكرًا لتواصلك معنا.', '您的投诉已关闭。感谢您与我们联系。'),
  },
  RECLAMATION_EN_RETARD: {
    titre: fixe('Dossier en retard', 'Overdue file', 'ملف متأخر', '逾期档案'),
    message: {
      fr: (p) => `${p.reference} : le délai de décision de ${p.delai} heures est dépassé. Une décision est attendue.`,
      en: (p) => `${p.reference}: the ${p.delai}-hour decision deadline has passed. A decision is expected.`,
      ar: (p) => `${p.reference}: تجاوز أجل القرار البالغ ${p.delai} ساعة. القرار مطلوب.`,
      'zh-Hans': (p) => `${p.reference}：${p.delai} 小时的决定期限已过，请尽快作出决定。`,
    },
  },
  RETRAIT_REJETE: {
    titre: fixe('Demande de retrait refusée', 'Withdrawal request refused', 'تم رفض طلب السحب', '提款申请被拒绝'),
    message: fixe('Votre demande de retrait n’a pas été acceptée. Contactez NZE pour plus d’informations.', 'Your withdrawal request was not accepted. Contact NZE for more information.', 'لم يتم قبول طلب السحب الخاص بك. تواصل مع NZE لمزيد من المعلومات.', '您的提款申请未获批准。如需更多信息，请联系 NZE。'),
  },
  RETRAIT_EN_COURS: {
    titre: fixe('Retrait en cours de versement', 'Withdrawal being paid out', 'السحب قيد الدفع', '提款正在转账中'),
    message: fixe('Votre demande de retrait est acceptée. Le versement est en cours.', 'Your withdrawal request is accepted. The payment is in progress.', 'تم قبول طلب السحب الخاص بك. الدفع جارٍ.', '您的提款申请已获批准，转账正在进行。'),
  },
  RETRAIT_VERSE: {
    titre: fixe('Retrait versé', 'Withdrawal paid', 'تم دفع السحب', '提款已到账'),
    message: fixe('Votre retrait a été versé sur votre compte Mobile Money.', 'Your withdrawal was paid to your Mobile Money account.', 'تم دفع مبلغ السحب إلى حسابك على Mobile Money.', '您的提款已转入您的 Mobile Money 账户。'),
  },
  MESSAGE_RECU: {
    titre: fixe('Nouveau message', 'New message', 'رسالة جديدة', '新消息'),
    message: fixe('NZE vous a écrit au sujet de votre article.', 'NZE wrote to you about your item.', 'كتبت لك NZE بخصوص منتجك.', 'NZE 就您的商品给您发来了消息。'),
  },
  RETRAIT_ECHEC: {
    titre: fixe('Retrait non abouti', 'Withdrawal failed', 'فشل السحب', '提款未成功'),
    message: fixe('Le versement de votre retrait n’a pas abouti. Le montant est rendu à votre solde. Contactez NZE.', 'The payment of your withdrawal failed. The amount is returned to your balance. Contact NZE.', 'فشل دفع مبلغ السحب. أُعيد المبلغ إلى رصيدك. تواصل مع NZE.', '提款转账未成功。金额已退回您的余额。请联系 NZE。'),
  },
  'STOCK_FAIBLE': {
    titre: fixe('Stock faible', 'Low stock', 'مخزون منخفض', '库存偏低'),
    message: {
      fr: (p) => `${p.produit} : il reste ${p.quantite} article(s) vendable(s).`,
      en: (p) => `${p.produit}: ${p.quantite} item(s) left for sale.`,
      ar: (p) => `${p.produit}: يتبقى ${p.quantite} عنصر قابل للبيع.`,
      'zh-Hans': (p) => `${p.produit}：仅剩 ${p.quantite} 件可售。`,
    },
  },
  'COMMANDE_EN_PREPARATION': {
    titre: fixe('Commande en préparation', 'Order being prepared', 'الطلب قيد التحضير', '订单备货中'),
    message: fixe('Votre commande est en préparation.', 'Your order is being prepared.', 'طلبك قيد التحضير.', '您的订单正在备货中。'),
  },
  'COMMANDE_PRETE': {
    titre: fixe('Commande prête', 'Order ready', 'الطلب جاهز', '订单已备好'),
    message: fixe('Votre commande est prête.', 'Your order is ready.', 'طلبك جاهز.', '您的订单已备好。'),
  },
  'ECHEANCE_RAPPEL': {
    titre: fixe('Échéance prochaine', 'Upcoming payment', 'قسط قادم', '即将到期的分期'),
    message: {
      fr: (p) => `${p.produit} : mois ${p.mois}, ${p.montant} FCFA à régler avant le ${p.date}.`,
      en: (p) => `${p.produit}: month ${p.mois}, ${p.montant} FCFA due before ${p.date}.`,
      ar: (p) => `${p.produit}: الشهر ${p.mois}، ${p.montant} FCFA مستحقة قبل ${p.date}.`,
      'zh-Hans': (p) => `${p.produit}：第 ${p.mois} 期，${p.date} 前需支付 ${p.montant} FCFA。`,
    },
  },
  'ECHEANCE_DU_JOUR': {
    titre: fixe('Échéance aujourd’hui', 'Payment due today', 'القسط مستحق اليوم', '今日到期'),
    message: {
      fr: (p) => `Aujourd’hui : ${p.montant} FCFA à régler pour le mois ${p.mois} de ${p.produit}.`,
      en: (p) => `Today: ${p.montant} FCFA due for month ${p.mois} of ${p.produit}.`,
      ar: (p) => `اليوم: ${p.montant} FCFA مستحقة للشهر ${p.mois} من ${p.produit}.`,
      'zh-Hans': (p) => `今日：${p.produit} 第 ${p.mois} 期需支付 ${p.montant} FCFA。`,
    },
  },
  'ECHEANCE_RETARD': {
    titre: fixe('Échéance non soldée', 'Payment overdue', 'قسط غير مسدد', '分期付款逾期'),
    message: {
      fr: (p) => `Le mois ${p.mois} de ${p.produit} n’est pas soldé : ${p.montant} FCFA restent dus. Réglez-le dès que possible depuis votre suivi.`,
      en: (p) => `Month ${p.mois} of ${p.produit} is not settled: ${p.montant} FCFA remain due. Please pay as soon as possible from your tracking.`,
      ar: (p) => `الشهر ${p.mois} من ${p.produit} غير مسدد: ${p.montant} FCFA ما زالت مستحقة. يرجى السداد في أقرب وقت من متابعتك.`,
      'zh-Hans': (p) => `${p.produit} 第 ${p.mois} 期尚未结清：仍需支付 ${p.montant} FCFA，请尽快在您的分期页面付款。`,
    },
  },
  'PENALITE_APPLIQUEE': {
    titre: fixe('Pénalité de retard', 'Late penalty', 'غرامة تأخير', '逾期罚款'),
    message: {
      fr: (p) => `Une pénalité de ${p.penalite} FCFA a été ajoutée à votre échéancier de ${p.produit} (retard n° ${p.mois}).`,
      en: (p) => `A ${p.penalite} FCFA penalty was added to your schedule for ${p.produit} (late month ${p.mois}).`,
      ar: (p) => `أُضيفت غرامة قدرها ${p.penalite} FCFA إلى جدول أقساط ${p.produit} (تأخير ${p.mois}).`,
      'zh-Hans': (p) => `您的 ${p.produit} 分期计划新增 ${p.penalite} FCFA 逾期罚款（第 ${p.mois} 次逾期）。`,
    },
  },
};

// Traduit une notification ; renvoie null si le type n'a pas de traduction (le texte d'origine reste utilisé).
export function traduire(cle: string, langue: LangueNotification, parametres: Parametres = {}): { titre: string; message: string } | null {
  const modele = TEXTES[cle];
  if (!modele) return null;
  const lg: LangueNotification = (LANGUES_NOTIFICATION as readonly string[]).includes(langue) ? langue : 'fr';
  return { titre: modele.titre[lg](parametres), message: modele.message[lg](parametres) };
}
