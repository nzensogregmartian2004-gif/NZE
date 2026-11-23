// Composants communs. Couleurs et espacements viennent du thème.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tailles, couleurs, espaces, rayons } from '../theme';

export function Ecran({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <SafeAreaView style={[styles.ecran, style]} edges={['top', 'bottom']}>{children}</SafeAreaView>;
}

export function Bouton({
  titre, onPress, variante = 'primaire', desactive = false, chargement = false,
}: { titre: string; onPress: () => void; variante?: 'primaire' | 'secondaire' | 'danger'; desactive?: boolean; chargement?: boolean }) {
  const fond = variante === 'primaire' ? couleurs.violet : variante === 'danger' ? couleurs.danger : couleurs.blanc;
  const texte = variante === 'secondaire' ? couleurs.violet : couleurs.blanc;
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive || chargement}
      accessibilityRole="button"
      style={({ pressed }) => [styles.bouton, { backgroundColor: fond, opacity: desactive ? 0.5 : pressed ? 0.85 : 1 }, variante === 'secondaire' && styles.boutonContour]}
    >
      {chargement ? <ActivityIndicator color={texte} /> : <Text style={[styles.boutonTexte, { color: texte }]}>{titre}</Text>}
    </Pressable>
  );
}

export function Champ({
  label, valeur, onChangeTexte, secret = false, clavier = 'default', placeholder, auto = 'off', multiligne = false,
}: { label: string; valeur: string; onChangeTexte: (t: string) => void; secret?: boolean; clavier?: KeyboardTypeOptions; placeholder?: string; auto?: 'off' | 'username'; multiligne?: boolean }) {
  return (
    <View style={styles.champ}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={valeur}
        onChangeText={onChangeTexte}
        secureTextEntry={secret}
        keyboardType={clavier}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={auto}
        placeholderTextColor={couleurs.texteSecondaire}
        multiline={multiligne}
        style={[styles.champInput, multiligne && styles.champMultiligne]}
      />
    </View>
  );
}

export function Message({ texte, type = 'erreur' }: { texte: string; type?: 'erreur' | 'succes' }) {
  return (
    <View style={[styles.message, { backgroundColor: type === 'erreur' ? couleurs.dangerClair : couleurs.succesClair }]}>
      <Text style={{ color: type === 'erreur' ? couleurs.danger : couleurs.succes }}>{texte}</Text>
    </View>
  );
}

export function Carte({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.carte, style]}>{children}</View>;
}

export function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <View style={styles.ligneInfo}>
      <Text style={styles.label}>{libelle}</Text>
      <Text style={styles.valeur}>{valeur}</Text>
    </View>
  );
}

export function Chargement() {
  return (
    <Ecran style={styles.centre}>
      <ActivityIndicator color={couleurs.violet} size="large" />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.blanc },
  centre: { alignItems: 'center', justifyContent: 'center' },
  bouton: { height: tailles.boutonHauteur, borderRadius: rayons.m, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espaces.l },
  boutonContour: { borderWidth: 1, borderColor: couleurs.violet },
  boutonTexte: { fontSize: 16, fontWeight: '700' },
  champ: { gap: espaces.xs, marginBottom: espaces.m },
  label: { fontSize: 13, color: couleurs.texteSecondaire },
  champMultiligne: { height: 120, textAlignVertical: 'top', paddingTop: espaces.s },
  champInput: { height: tailles.champHauteur, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: rayons.m, paddingHorizontal: espaces.m, fontSize: 16, color: couleurs.texte },
  message: { padding: espaces.m, borderRadius: rayons.m, marginBottom: espaces.m },
  carte: { backgroundColor: couleurs.blanc, borderRadius: rayons.l, borderWidth: 1, borderColor: couleurs.bordure, padding: espaces.m },
  ligneInfo: { gap: espaces.xs },
  valeur: { fontSize: 15, color: couleurs.texte, fontWeight: '600' },
});
