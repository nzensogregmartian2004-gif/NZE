// Liste paginée côté application : charge la première page, puis les suivantes à la demande (« Charger plus »).
// Un changement de chemin (filtre) repart de la première page ; une réponse ancienne est ignorée.
import { useCallback, useRef, useState } from 'react';
import { appeler } from '../api/client';
import { fusionnerPages } from './pagination';

export const TAILLE_LISTE = 50;

export function useListePaginee<T extends { id: string }>(chemin: string, taille: number = TAILLE_LISTE) {
  const [elements, setElements] = useState<T[]>([]);
  const [chargement, setChargement] = useState(false);
  const [plusDisponible, setPlusDisponible] = useState(false);
  const [erreur, setErreur] = useState(false);
  const requete = useRef(0);
  const recus = useRef(0);

  const charger = useCallback(async (decalage: number) => {
    const numero = ++requete.current;
    setChargement(true);
    const sep = chemin.includes('?') ? '&' : '?';
    try {
      const page = await appeler<T[]>(`${chemin}${sep}limite=${taille}&decalage=${decalage}`);
      if (numero !== requete.current) return;
      recus.current = decalage + page.length;
      setErreur(false);
      setElements((actuels) => (decalage === 0 ? fusionnerPages([], page) : fusionnerPages(actuels, page)));
      setPlusDisponible(page.length >= taille);
    } catch {
      if (numero !== requete.current) return;
      if (decalage === 0) { setElements([]); setErreur(true); }
      setPlusDisponible(false);
    } finally {
      if (numero === requete.current) setChargement(false);
    }
  }, [chemin, taille]);

  const recharger = useCallback(() => { void charger(0); }, [charger]);
  const chargerPlus = useCallback(() => {
    if (!chargement && plusDisponible) void charger(recus.current);
  }, [charger, chargement, plusDisponible]);

  return { elements, setElements, chargement, plusDisponible, erreur, recharger, chargerPlus };
}
