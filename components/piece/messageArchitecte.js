// Phrase à afficher après « Aménager » ou Shuffle (réponse.architecte) ; vide si Claude n'a pas servi.
export function messageArchitecte(architecte, lang) {
  if (!architecte) return '';
  const fr = lang !== 'en';
  if (architecte.titre) return fr ? `Idée de Claude : « ${architecte.titre} ». Le moteur l’a posée en gardant les passages libres.`
    : `Claude’s idea: “${architecte.titre}”. The engine laid it out with clear passages.`;
  const messages = {
    'architecte-inactif': '',
    'architecte-ne-tient-pas': fr ? 'L’idée de Claude ne tenait pas avec les passages : voici celle du moteur. Shuffle essaiera les suivantes.'
      : 'Claude’s idea did not fit with clear passages: here is the engine’s. Shuffle will try the next ones.',
    'architecte-limite': fr ? 'Claude a atteint sa limite du jour : le moteur a aménagé seul.' : 'Claude reached today’s limit: the engine furnished the room on its own.'
  };
  return messages[architecte.erreur] ?? (fr ? 'Claude n’a pas répondu : le moteur a aménagé seul.' : 'Claude did not answer: the engine furnished the room on its own.');
}
