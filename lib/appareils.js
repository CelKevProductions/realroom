// Le navigateur ne révèle pas le modèle d'iPhone ni la présence de LiDAR.
// L'application Apple vérifie le capteur ; WebXR vérifie l'AR Android.
export function appareilCapture({userAgent='',platform='',maxTouchPoints=0}={}) {
  if(/iPhone|iPad|iPod/i.test(userAgent)||(/Mac/i.test(platform)&&maxTouchPoints>1))return 'apple';
  if(/Android/i.test(userAgent))return 'android';
  return 'ordinateur';
}
