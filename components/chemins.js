'use client';
// Racine des pages de l'application : /fr/app pour un compte, /fr/demo pour la démo sans compte.
// Les composants construisent leurs liens à partir d'elle.
import { createContext, useContext } from 'react';

const Racine = createContext(null);
export const RacineApp = Racine.Provider;
export function useRacine(lang) {
  return useContext(Racine) || `/${lang}/app`;
}
