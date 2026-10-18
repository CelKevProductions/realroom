'use client';
// Suit le réglage « réduire les animations » pendant la visite (posé une fois dans la mise en page).
import { useEffect } from 'react';
import { suivrePreference } from './regles.js';

export default function PreferenceMouvement() {
  useEffect(() => suivrePreference(), []);
  return null;
}
