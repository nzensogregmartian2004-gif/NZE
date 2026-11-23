export type Step15Language = "fr" | "en";
export type GuideKey = "client" | "store" | "restaurant" | "professional" | "lodging" | "vehicle" | "deliverer" | "admin";
export type GuideStep = { title: string; body: string };
export type Guide = { title: string; intro: string; steps: GuideStep[] };

export const STEP15_COPY = {
  fr: {
    helpTitle: "Centre d'aide", helpIntro: "Guides, réponses rapides et contact du support.",
    search: "Rechercher dans l'aide", noArticles: "Aucun article trouvé.",
    guidesTitle: "Tutoriels interactifs", restartGuide: "Relancer le tutoriel", chooseGuide: "Choisis un parcours à revoir.",
    notificationsTitle: "Notifications", markAllRead: "Tout marquer comme lu", emptyNotifications: "Aucune notification pour le moment.",
    prefsTitle: "Préférences des notifications dans l'application", inAppEnabled: "Activer les notifications dans NZE",
    orderUpdates: "Commandes et stock", deliveryUpdates: "Livraisons et missions", paymentUpdates: "Paiements et remboursements",
    bookingUpdates: "Réservations", serviceUpdates: "Prestations et support", reviewsReportsUpdates: "Avis et signalements",
    marketingUpdates: "Promotions et campagnes", systemUpdates: "Informations importantes de NZE",
    pushNote: "Les notifications push, SMS et e-mail nécessitent un fournisseur externe configuré. Ces réglages concernent les notifications enregistrées dans NZE.",
    back: "Retour", previous: "Précédent", next: "Suivant", skip: "Passer le tutoriel", finish: "Terminer", step: "Étape", of: "sur",
    loading: "Chargement…", saveFailed: "La progression n'a pas pu être synchronisée. Tu peux tout de même continuer.",
    contactTitle: "Contacter le support", contactSubject: "Objet", contactCategory: "Catégorie", contactMessage: "Décris le problème (10 caractères minimum)",
    sendRequest: "Envoyer la demande", requestSent: "Ta demande a été envoyée au support.", myRequests: "Mes demandes", noRequests: "Tu n'as pas encore contacté le support.",
    status: "Statut", category: "Catégorie", read: "Marquer comme lu", language: "Langue", languageChanged: "La langue a été mise à jour.",
    guideNames: { client: "Client", store: "Commerçant", restaurant: "Restaurant", professional: "Prestataire", lodging: "Hébergeur", vehicle: "Loueur de véhicules", deliverer: "Livreur NZE", admin: "Administration" },
    categories: { compte: "Compte", commande: "Commande", paiement: "Paiement", livraison: "Livraison", reservation: "Réservation", prestation: "Prestation", signalement: "Signalement", autre: "Autre" },
  },
  en: {
    helpTitle: "Help center", helpIntro: "Guides, quick answers and support contact.",
    search: "Search help articles", noArticles: "No articles found.",
    guidesTitle: "Interactive tutorials", restartGuide: "Restart tutorial", chooseGuide: "Choose a journey to review.",
    notificationsTitle: "Notifications", markAllRead: "Mark all as read", emptyNotifications: "No notifications yet.",
    prefsTitle: "In-app notification preferences", inAppEnabled: "Enable NZE in-app notifications",
    orderUpdates: "Orders and stock", deliveryUpdates: "Deliveries and tasks", paymentUpdates: "Payments and refunds",
    bookingUpdates: "Bookings", serviceUpdates: "Services and support", reviewsReportsUpdates: "Reviews and reports",
    marketingUpdates: "Promotions and campaigns", systemUpdates: "Important NZE updates",
    pushNote: "Push, SMS and email notifications require a configured external provider. These settings apply to notifications stored in NZE.",
    back: "Back", previous: "Previous", next: "Next", skip: "Skip tutorial", finish: "Finish", step: "Step", of: "of",
    loading: "Loading…", saveFailed: "Progress could not be synced. You can still continue.",
    contactTitle: "Contact support", contactSubject: "Subject", contactCategory: "Category", contactMessage: "Describe the issue (at least 10 characters)",
    sendRequest: "Send request", requestSent: "Your request was sent to support.", myRequests: "My requests", noRequests: "You have not contacted support yet.",
    status: "Status", category: "Category", read: "Mark as read", language: "Language", languageChanged: "Language updated.",
    guideNames: { client: "Customer", store: "Merchant", restaurant: "Restaurant", professional: "Service provider", lodging: "Accommodation host", vehicle: "Vehicle rental", deliverer: "NZE courier", admin: "Administration" },
    categories: { compte: "Account", commande: "Order", paiement: "Payment", livraison: "Delivery", reservation: "Booking", prestation: "Service", signalement: "Report", autre: "Other" },
  },
} as const;

export const GUIDES: Record<Step15Language, Record<GuideKey, Guide>> = {
  fr: {
    client: { title: "Découvrir NZE comme client", intro: "Les essentiels pour trouver, commander et suivre tes achats.", steps: [
      { title: "Explore les univers", body: "Parcours les produits, magasins, restaurants, services, hébergements et locations depuis l'accueil." },
      { title: "Recherche et compare", body: "Utilise la recherche et les filtres. Compare le vendeur, les caractéristiques, les prix et la disponibilité." },
      { title: "Prépare ta commande", body: "Vérifie les quantités, le mode de remise et les frais éventuels avant de confirmer." },
      { title: "Vérifie le paiement", body: "Un paiement reste en attente tant que le prestataire n'a pas confirmé le résultat final. La commande et le paiement ont des statuts distincts." },
      { title: "Suis et demande de l'aide", body: "Consulte tes commandes, messages et notifications. En cas de problème, utilise le centre d'aide." },
    ]},
    store: { title: "Découvrir l'espace commerçant", intro: "Gère une boutique, ses produits et ses commandes.", steps: [
      { title: "Complète la boutique", body: "Renseigne un nom clair, une description et une zone de service exacte." },
      { title: "Garde le catalogue à jour", body: "Vérifie régulièrement les prix, les images, les variantes et les quantités en stock." },
      { title: "Traite les commandes", body: "Accepte ou refuse les commandes selon le stock et ta capacité. Prépare-les avant le passage à l'étape suivante." },
      { title: "Choisis le mode de remise", body: "Active uniquement les modes réellement proposés : retrait, tes livreurs ou livraison NZE." },
      { title: "Consulte les finances", body: "Distingue les commandes, paiements confirmés, remboursements et montants dus. Une commande terminée ne prouve pas un encaissement." },
    ]},
    restaurant: { title: "Découvrir l'espace restaurant", intro: "Configure les menus et traite les commandes de repas.", steps: [
      { title: "Configure l'établissement", body: "Indique le type de cuisine, les horaires, le temps de préparation et les options de remise." },
      { title: "Organise le menu", body: "Classe les plats, renseigne les prix, ingrédients, allergènes et suppléments disponibles." },
      { title: "Actualise les disponibilités", body: "Marque temporairement un plat indisponible lorsqu'il est épuisé au lieu de supprimer son historique." },
      { title: "Prépare les commandes", body: "Accepte la commande, renseigne un délai réaliste et marque-la prête une fois la préparation finie." },
      { title: "Choisis la livraison", body: "Tu peux utiliser tes livreurs, les livreurs NZE ou le retrait, selon les options configurées." },
    ]},
    professional: { title: "Découvrir l'espace prestataire", intro: "Présente tes compétences et organise les demandes de service.", steps: [
      { title: "Présente ton métier", body: "Décris tes spécialités, ta zone d'intervention et tes tarifs indicatifs." },
      { title: "Construis la confiance", body: "Garde des informations exactes et publie uniquement des réalisations que tu es autorisé à montrer." },
      { title: "Réponds aux demandes", body: "Clarifie le besoin, le lieu et le délai avant d'accepter ou refuser une demande." },
      { title: "Suis la prestation", body: "Mets le statut à jour à chaque étape et ne la termine qu'une fois réellement réalisée." },
      { title: "Consulte les avis", body: "Les avis et les montants indicatifs doivent rester fidèles aux prestations réelles. Une valeur affichée n'est pas une preuve de paiement." },
    ]},
    lodging: { title: "Découvrir l'espace hébergeur", intro: "Gère tes logements, tarifs et demandes de réservation.", steps: [
      { title: "Crée une annonce claire", body: "Ajoute type de logement, capacité, équipements, adresse approximative et conditions de séjour." },
      { title: "Définis les tarifs", body: "Explique la période, les frais supplémentaires et les conditions de paiement ou de caution." },
      { title: "Vérifie le calendrier", body: "Contrôle la disponibilité réelle avant d'accepter une demande afin d'éviter les chevauchements." },
      { title: "Confirme les réservations", body: "Une demande reste en attente jusqu'à ton acceptation. Mets le statut à jour pour informer le client." },
      { title: "Gère les changements", body: "Traite annulations et incidents selon les conditions affichées, puis garde l'historique à jour." },
    ]},
    vehicle: { title: "Découvrir l'espace loueur", intro: "Publie tes véhicules et contrôle leurs disponibilités.", steps: [
      { title: "Prépare la fiche", body: "Renseigne les caractéristiques, l'état du véhicule, les photos et les conditions de location." },
      { title: "Définis les prix", body: "Indique la période tarifaire, les éventuelles cautions et les exigences applicables." },
      { title: "Bloque les périodes indisponibles", body: "Prends en compte entretien, réparations et locations déjà acceptées." },
      { title: "Traite les demandes", body: "Vérifie les dates avant d'accepter une location. Ne confirme pas deux demandes incompatibles." },
      { title: "Termine la location", body: "Mets à jour la restitution et signale tout incident selon le processus prévu." },
    ]},
    deliverer: { title: "Découvrir l'espace livreur NZE", intro: "Accepte une mission et confirme la remise du colis.", steps: [
      { title: "Reste disponible", body: "Active ta disponibilité seulement lorsque tu peux réellement prendre une mission." },
      { title: "Vérifie la mission", body: "Consulte le point de collecte, la destination et les consignes avant d'accepter." },
      { title: "Mets les statuts à jour", body: "Indique les étapes de collecte et de transport de manière fidèle." },
      { title: "Protège les données", body: "Utilise les coordonnées du client uniquement pour accomplir la livraison." },
      { title: "Confirme la remise", body: "Suis la méthode de preuve prévue dans NZE. La preuve de livraison n'est pas une preuve de paiement." },
    ]},
    admin: { title: "Découvrir l'administration", intro: "Administre NZE selon ton rôle et tes permissions.", steps: [
      { title: "Vérifie ton rôle", body: "Chaque compte administratif dispose de permissions limitées. N'utilise que les fonctions autorisées." },
      { title: "Modère les annonces", body: "Examine les éléments nécessaires et motive les décisions sensibles." },
      { title: "Protège les données", body: "Consulte uniquement les informations nécessaires à ton travail et ne partage pas les secrets." },
      { title: "Respecte la traçabilité", body: "Les changements sensibles sont journalisés. Ne modifie pas manuellement le statut d'un paiement confirmé par le fournisseur." },
      { title: "Traite le support", body: "Réponds aux demandes avec des informations utiles et mets leur statut à jour." },
    ]},
  },
  en: {
    client: { title: "Discover NZE as a customer", intro: "The essentials for finding, ordering and tracking purchases.", steps: [
      { title: "Explore the sections", body: "Browse products, stores, restaurants, services, accommodation and rentals from the home screen." },
      { title: "Search and compare", body: "Use search and filters. Compare sellers, specifications, prices and availability." },
      { title: "Prepare your order", body: "Check quantities, handover method and any fees before confirming." },
      { title: "Check payment status", body: "A payment remains pending until the provider confirms the final result. Order and payment have separate statuses." },
      { title: "Track and get help", body: "Review orders, messages and notifications. Contact support through the help center when something goes wrong." },
    ]},
    store: { title: "Discover the merchant space", intro: "Manage a store, its products and orders.", steps: [
      { title: "Complete your store", body: "Provide a clear name, description and accurate service area." },
      { title: "Keep the catalogue current", body: "Regularly check prices, images, variants and stock quantities." },
      { title: "Process orders", body: "Accept or refuse orders according to stock and capacity. Prepare them before moving to the next step." },
      { title: "Choose handover methods", body: "Enable only options actually offered: pickup, your own couriers or NZE delivery." },
      { title: "Review finances", body: "Separate orders, confirmed payments, refunds and amounts due. A completed order does not prove payment was collected." },
    ]},
    restaurant: { title: "Discover the restaurant space", intro: "Configure menus and process food orders.", steps: [
      { title: "Set up your restaurant", body: "Enter cuisine type, hours, preparation time and handover options." },
      { title: "Organize the menu", body: "Group dishes and provide prices, ingredients, allergens and available extras." },
      { title: "Update availability", body: "Temporarily mark a dish unavailable when sold out instead of deleting its history." },
      { title: "Prepare orders", body: "Accept the order, provide a realistic time and mark it ready when preparation is complete." },
      { title: "Choose delivery", body: "Use your own couriers, NZE couriers or pickup, according to your configured options." },
    ]},
    professional: { title: "Discover the service-provider space", intro: "Show your skills and organize service requests.", steps: [
      { title: "Describe your work", body: "Explain your specialties, service area and indicative prices." },
      { title: "Build trust", body: "Keep details accurate and publish only work samples you are allowed to show." },
      { title: "Respond to requests", body: "Clarify needs, location and timing before accepting or declining a request." },
      { title: "Track the service", body: "Update each status and mark it completed only after the work is actually done." },
      { title: "Review feedback", body: "Reviews and indicative amounts should reflect real work. A displayed value is not proof of payment." },
    ]},
    lodging: { title: "Discover the accommodation-host space", intro: "Manage listings, prices and booking requests.", steps: [
      { title: "Create a clear listing", body: "Add accommodation type, capacity, amenities, approximate address and stay terms." },
      { title: "Set prices", body: "Explain the pricing period, extra charges and payment or deposit terms." },
      { title: "Check the calendar", body: "Verify actual availability before accepting a request to avoid overlaps." },
      { title: "Confirm bookings", body: "A request stays pending until you accept it. Update the status to inform the guest." },
      { title: "Handle changes", body: "Process cancellations and incidents according to the displayed terms and keep the history updated." },
    ]},
    vehicle: { title: "Discover the vehicle-rental space", intro: "List vehicles and manage availability.", steps: [
      { title: "Prepare the listing", body: "Enter specifications, vehicle condition, photos and rental terms." },
      { title: "Set prices", body: "Specify the pricing period, possible deposits and applicable requirements." },
      { title: "Block unavailable periods", body: "Account for maintenance, repairs and already accepted rentals." },
      { title: "Handle requests", body: "Check dates before accepting a rental. Do not confirm incompatible requests." },
      { title: "Complete the rental", body: "Update the return and report any incident through the required process." },
    ]},
    deliverer: { title: "Discover the NZE courier space", intro: "Accept a task and confirm handover.", steps: [
      { title: "Stay available", body: "Enable availability only when you can actually accept a task." },
      { title: "Review the task", body: "Check pickup, destination and instructions before accepting." },
      { title: "Update statuses", body: "Record pickup and transport steps accurately." },
      { title: "Protect personal data", body: "Use customer contact details only to complete the delivery." },
      { title: "Confirm handover", body: "Follow the proof method required by NZE. Delivery proof is not proof of payment." },
    ]},
    admin: { title: "Discover administration", intro: "Manage NZE according to your role and permissions.", steps: [
      { title: "Check your role", body: "Each administrator has limited permissions. Use only the functions you are authorized for." },
      { title: "Moderate listings", body: "Review relevant evidence and explain sensitive decisions." },
      { title: "Protect data", body: "Access only information required for your work and never share secrets." },
      { title: "Keep an audit trail", body: "Sensitive changes are logged. Do not manually change a payment status confirmed by the provider." },
      { title: "Handle support", body: "Respond with useful information and update the request status." },
    ]},
  },
};

export const GUIDE_KEYS: GuideKey[] = ["client", "store", "restaurant", "professional", "lodging", "vehicle", "deliverer", "admin"];

export type HelpArticle = { id: string; category: string; roles: string[]; title: string; summary: string; body: string[] };
