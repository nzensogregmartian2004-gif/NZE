/**
 * Conditions d'utilisation et politique de confidentialité (étape 17).
 * Texte de travail : il doit être validé par un juriste avant publication.
 * Toute modification substantielle exige d'incrémenter LEGAL_VERSION : les utilisateurs
 * devront alors accepter de nouveau à leur prochaine inscription.
 */
export type Lang = "fr" | "en";
export type LegalSlug = "cgu" | "confidentialite";
export type LegalSection = { heading: string; paragraphs: string[] };
export type LegalDocument = { slug: LegalSlug; title: string; sections: LegalSection[] };
export type CompanyInfo = { name: string; address: string; email: string };

export const LEGAL_VERSION = "1.0";
/** Date d'effet affichée aux utilisateurs : à mettre à jour avant chaque publication. */
export const LEGAL_EFFECTIVE_DATE = "2026-11-01";

export function buildLegalDocuments(c: CompanyInfo): Record<Lang, LegalDocument[]> {
  return {
    fr: [
      {
        slug: "cgu",
        title: "Conditions générales d'utilisation",
        sections: [
          { heading: "1. Objet", paragraphs: [
            `Les présentes conditions encadrent l'utilisation de l'application NZE et des services associés.`,
            `En créant un compte, tu acceptes ces conditions et la politique de confidentialité.`,
          ] },
          { heading: "2. Comptes", paragraphs: [
            `Tu dois fournir des informations exactes et protéger tes identifiants, ton mot de passe et ton code de vérification.`,
            `Un même compte peut disposer de plusieurs rôles (client, commerçant, livreur). Les rôles professionnels sont soumis à vérification par NZE.`,
          ] },
          { heading: "3. Rôle de la plateforme", paragraphs: [
            `NZE met en relation des clients avec des commerçants partenaires, et organise la livraison de leurs produits par des livreurs.`,
            `Les offres, prix, disponibilités et conditions sont publiés par les professionnels. Les contrats conclus entre utilisateurs relèvent de ces derniers.`,
          ] },
          { heading: "4. Commandes, réservations et paiements", paragraphs: [
            `Une commande ou une réservation n'est confirmée qu'après acceptation du professionnel concerné.`,
            `Les paiements en ligne sont traités par MyPVIT, selon les moyens disponibles au moment de la commande. Un paiement n'est considéré comme réussi qu'après confirmation officielle.`,
            `Une livraison terminée et un paiement confirmé sont deux informations distinctes.`,
          ] },
          { heading: "5. Contenus et comportements interdits", paragraphs: [
            `Sont interdits : publier des annonces illicites ou non autorisées, fournir de fausses informations, usurper une identité, harceler un utilisateur, ou tenter d'accéder à des données ou fonctions non autorisées.`,
            `NZE peut masquer, suspendre ou supprimer un contenu ou un compte qui ne respecte pas ces règles.`,
          ] },
          { heading: "6. Avis et signalements", paragraphs: [
            `Un avis doit reposer sur une prestation réellement effectuée. Tout utilisateur peut signaler un contenu ou un comportement abusif.`,
          ] },
          { heading: "7. Disponibilité et responsabilité", paragraphs: [
            `NZE s'efforce d'assurer un accès continu au service, sans garantir une disponibilité ininterrompue.`,
            `NZE n'est pas responsable de la qualité des biens et services fournis par les professionnels, dans les limites prévues par la loi.`,
          ] },
          { heading: "8. Modifications", paragraphs: [
            `NZE peut mettre à jour ces conditions. La version et la date d'effet figurent en tête du document. Un changement important peut exiger une nouvelle acceptation.`,
          ] },
          { heading: "9. Droit applicable et contact", paragraphs: [
            `Les présentes conditions sont soumises au droit applicable en République gabonaise.`,
            `Contact : ${c.name} — ${c.address} — ${c.email}.`,
          ] },
        ],
      },
      {
        slug: "confidentialite",
        title: "Politique de confidentialité",
        sections: [
          { heading: "1. Responsable du traitement", paragraphs: [
            `${c.name}, ${c.address}. Contact : ${c.email}.`,
          ] },
          { heading: "2. Données collectées", paragraphs: [
            `Identité (nom, prénom), numéro de téléphone, adresse e-mail facultative, mot de passe (conservé sous forme chiffrée, jamais en clair).`,
            `Selon ton usage : localisation (si tu l'autorises), commandes, réservations, messages, avis et documents demandés aux professionnels.`,
          ] },
          { heading: "3. Finalités", paragraphs: [
            `Créer et sécuriser ton compte, vérifier ton numéro, traiter commandes, réservations, livraisons et paiements, assurer le support, prévenir la fraude et respecter nos obligations légales.`,
          ] },
          { heading: "4. Partage des données", paragraphs: [
            `Les données ne sont partagées que dans la mesure nécessaire : avec les commerçants partenaires concernés, avec les livreurs pour la remise (informations limitées), avec MyPVIT pour les paiements, et avec nos sous-traitants techniques (envoi de SMS, hébergement, cartographie).`,
          ] },
          { heading: "5. Localisation", paragraphs: [
            `La localisation sert à la recherche de proximité, à la livraison et au suivi. Tu peux la désactiver à tout moment dans les réglages de ton téléphone.`,
          ] },
          { heading: "6. Conservation", paragraphs: [
            `Les données sont conservées pendant la durée de ton compte et, si la loi l'impose, pendant la durée qu'elle prévoit. À la fermeture du compte, elles sont supprimées ou anonymisées, sauf obligation légale contraire.`,
          ] },
          { heading: "7. Sécurité", paragraphs: [
            `Nous limitons l'accès aux données, chiffrons les mots de passe, protégeons les échanges et journalisons les opérations sensibles.`,
          ] },
          { heading: "8. Tes droits", paragraphs: [
            `Tu peux demander l'accès à tes données, leur rectification, leur suppression ou la fermeture de ton compte, en écrivant à ${c.email} ou via le centre d'aide de l'application.`,
          ] },
        ],
      },
    ],
    en: [
      {
        slug: "cgu",
        title: "Terms of use",
        sections: [
          { heading: "1. Purpose", paragraphs: [
            `These terms govern the use of the NZE application and related services.`,
            `By creating an account, you accept these terms and the privacy policy.`,
          ] },
          { heading: "2. Accounts", paragraphs: [
            `You must provide accurate information and keep your login details, password and verification code confidential.`,
            `One account may hold several roles (customer, merchant, courier). Professional roles are subject to verification by NZE.`,
          ] },
          { heading: "3. Role of the platform", paragraphs: [
            `NZE connects customers with partner merchants and organises delivery of their products by couriers.`,
            `Offers, prices, availability and conditions are published by professionals. Contracts between users are concluded between those users.`,
          ] },
          { heading: "4. Orders, bookings and payments", paragraphs: [
            `An order or booking is confirmed only once the professional concerned accepts it.`,
            `Online payments are processed by MyPVIT, using the methods available at the time of the order. A payment is considered successful only after official confirmation.`,
            `A completed delivery and a confirmed payment are two separate pieces of information.`,
          ] },
          { heading: "5. Prohibited content and conduct", paragraphs: [
            `It is prohibited to publish unlawful or unauthorised listings, provide false information, impersonate someone, harass a user, or attempt to access data or features you are not authorised to use.`,
            `NZE may hide, suspend or remove any content or account that breaches these rules.`,
          ] },
          { heading: "6. Reviews and reports", paragraphs: [
            `A review must be based on a service actually provided. Any user may report content or behaviour that appears abusive.`,
          ] },
          { heading: "7. Availability and liability", paragraphs: [
            `NZE endeavours to keep the service available but does not guarantee uninterrupted access.`,
            `NZE is not responsible for the quality of goods and services supplied by professionals, within the limits set by applicable law.`,
          ] },
          { heading: "8. Changes", paragraphs: [
            `NZE may update these terms. The version and effective date appear at the top of the document. A significant change may require you to accept the terms again.`,
          ] },
          { heading: "9. Governing law and contact", paragraphs: [
            `These terms are governed by the law applicable in the Gabonese Republic.`,
            `Contact: ${c.name} — ${c.address} — ${c.email}.`,
          ] },
        ],
      },
      {
        slug: "confidentialite",
        title: "Privacy policy",
        sections: [
          { heading: "1. Data controller", paragraphs: [
            `${c.name}, ${c.address}. Contact: ${c.email}.`,
          ] },
          { heading: "2. Data we collect", paragraphs: [
            `Identity (first and last name), phone number, optional e-mail address, and password (stored in encrypted form, never in clear text).`,
            `Depending on how you use the app: location (if you allow it), orders, bookings, messages, reviews and documents requested by professionals.`,
          ] },
          { heading: "3. Purposes", paragraphs: [
            `To create and secure your account, verify your phone number, process orders, bookings, deliveries and payments, provide support, prevent fraud and meet our legal obligations.`,
          ] },
          { heading: "4. Sharing", paragraphs: [
            `Data is shared only as far as necessary: with the partner merchants concerned, with couriers for handover (limited information), with MyPVIT for payments, and with our technical subprocessors (SMS delivery, hosting, mapping).`,
          ] },
          { heading: "5. Location", paragraphs: [
            `Location is used for nearby search, delivery and tracking. You can turn it off at any time in your phone settings.`,
          ] },
          { heading: "6. Retention", paragraphs: [
            `Data is kept for as long as your account exists and, where the law requires it, for the period it sets. When an account is closed, data is deleted or anonymised, unless a legal obligation requires otherwise.`,
          ] },
          { heading: "7. Security", paragraphs: [
            `We restrict access to data, encrypt passwords, protect communications and log sensitive operations.`,
          ] },
          { heading: "8. Your rights", paragraphs: [
            `You may request access to your data, its correction or deletion, or the closure of your account, by writing to ${c.email} or through the help centre in the app.`,
          ] },
        ],
      },
    ],
  };
}
