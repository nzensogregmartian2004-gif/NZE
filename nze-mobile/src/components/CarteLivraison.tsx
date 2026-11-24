// Carte de livraison : satellite, position du client, position du livreur et itinéraire routier (Mapbox).
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Mapbox, { Camera, LineLayer, MapView, PointAnnotation, ShapeSource } from '@rnmapbox/maps';
import { cadrageCarte, doitRecalculerTrace, extraireTrace, type Coordonnees } from '../lib/carte';
import { couleurs } from '../theme';

// Jeton PUBLIC Mapbox (EXPO_PUBLIC_MAPBOX_TOKEN). Le jeton secret n'est jamais utilisé dans l'application.
const JETON = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
if (JETON) Mapbox.setAccessToken(JETON);
const STYLE_SATELLITE = 'mapbox://styles/mapbox/satellite-streets-v12';

export function CarteLivraison({ destination, livreur }: { destination: Coordonnees; livreur: Coordonnees | null }) {
  const [trace, setTrace] = useState<[number, number][] | null>(null);
  const departLat = livreur?.latitude ?? destination.latitude;
  const departLon = livreur?.longitude ?? destination.longitude;

  const dernierDepart = useRef<Coordonnees | null>(null);

  useEffect(() => {
    if (!JETON) return;
    const depart = { latitude: departLat, longitude: departLon };
    if (!doitRecalculerTrace(dernierDepart.current, depart)) return;
    dernierDepart.current = depart;
    const coordonnees = `${departLon},${departLat};${destination.longitude},${destination.latitude}`;
    fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordonnees}?geometries=geojson&overview=full&access_token=${JETON}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((corps) => setTrace(extraireTrace(corps)))
      .catch(() => setTrace(null));
  }, [departLat, departLon, destination.latitude, destination.longitude]);

  const cadre = cadrageCarte(livreur ? [destination, livreur] : [destination]);

  return (
    <View style={styles.cadre}>
      <MapView style={styles.carte} styleURL={STYLE_SATELLITE}>
        <Camera
          bounds={{ ne: cadre.ne, sw: cadre.sw, paddingTop: 40, paddingBottom: 40, paddingLeft: 40, paddingRight: 40 }}
          animationDuration={600}
        />
        <PointAnnotation id="client" coordinate={[destination.longitude, destination.latitude]}>
          <View style={styles.pointClient} />
        </PointAnnotation>
        {livreur ? (
          <PointAnnotation id="livreur" coordinate={[livreur.longitude, livreur.latitude]}>
            <View style={styles.pointLivreur} />
          </PointAnnotation>
        ) : null}
        {trace ? (
          <ShapeSource id="itineraire" shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates: trace }, properties: {} }}>
            <LineLayer id="itineraire-ligne" style={{ lineColor: couleurs.violet, lineWidth: 5 }} />
          </ShapeSource>
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { height: 260, borderRadius: 12, overflow: 'hidden' },
  carte: { flex: 1 },
  pointClient: { width: 18, height: 18, borderRadius: 9, backgroundColor: couleurs.violet, borderWidth: 3, borderColor: '#fff' },
  pointLivreur: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#22c55e', borderWidth: 3, borderColor: '#fff' },
});
