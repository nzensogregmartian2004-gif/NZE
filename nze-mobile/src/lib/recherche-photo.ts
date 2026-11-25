// Recherche par photo : type MIME de l'image envoyée au serveur (JPEG par défaut, PNG et WebP acceptés).
export function typeMimeImage(mime: string | null | undefined): string {
  return mime === 'image/png' || mime === 'image/webp' ? mime : 'image/jpeg';
}
