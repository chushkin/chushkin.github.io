// SPB Brain Evolution - Znax / Quadronica Alias
// In the original C++ codebase (_ZNAX_INO.ino), the minigame is named CZnax_GameField
// and user-facing title is "Quadronica" (Квадроника).
// This module bridges Znax to QuadronicaGame for 100% authentic gameplay.

import { QuadronicaGame } from './quadronica.js';

export class ZnaxGame extends QuadronicaGame {
  constructor(container, onComplete, onOpenMenu, onOpenHelp) {
    super(container, onComplete, onOpenMenu, onOpenHelp);
  }
}
