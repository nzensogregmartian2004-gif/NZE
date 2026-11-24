// Configuration dynamique. Le jeton de téléchargement Mapbox (secret) est lu dans les secrets EAS au moment du build :
// il n'est jamais écrit dans le dépôt.
module.exports = ({ config }) => {
  const plugins = (config.plugins ?? []).filter(
    (p) => !(p === '@rnmapbox/maps' || (Array.isArray(p) && p[0] === '@rnmapbox/maps')),
  );
  plugins.push(['@rnmapbox/maps', { RNMapboxMapsDownloadToken: process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN }]);
  return { ...config, plugins };
};
