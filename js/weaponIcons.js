// Weapon silhouettes shared by the HUD bar and the inventory.
export const SWORD=`<svg viewBox="0 0 24 24" class="wi"><path d="M20.5 3.5l-.7 4.2-9.6 9.6-3.5-3.5 9.6-9.6z" fill="currentColor"/><path d="M5.2 12.6l6.2 6.2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M8 16l-3.6 3.6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="3.9" cy="20.1" r="1.5" fill="currentColor"/></svg>`;
export const BLASTER=`<svg viewBox="0 0 24 24" class="wi"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a2 2 0 0 1 2 2v4.2a1.8 1.8 0 0 1-1.8 1.8H13l-.9 1.6H9.6l.4-1.6H6.6L5.6 19.4a1.6 1.6 0 0 1-1.5 1H3.2z" fill="currentColor"/><rect x="16.2" y="7.2" width="3" height="2.2" rx="1" fill="#2b2150" opacity=".55"/></svg>`;
const SV=d=>`<svg viewBox="0 0 24 24" class="wi">${d}</svg>`;
export const WEAPON_ICONS={
  peashooter:BLASTER,woodensword:SWORD,
  ak47:SV('<path d="M1 12.5l4.5-2.2H12l1-1.3h7.5l1.5 1.3v1.6H15l-1 1H11l-.5 5H8l.6-5H6l-2.2 1.6H1z" fill="currentColor"/>'),
  armalite:SV('<path d="M1 12l4-2h2l1-1.6h3.2l.8 1.2h9l1 1.2v1.3H14l-1 1.2h-2.4l-.4 5H7.8L8.4 13H5.5L3 14.4H1z" fill="currentColor"/>'),
  machinegun:SV('<path d="M1 11.5l3-1.6h8l.8-1h7.7v1.4l1.5 1v1.5H14l-1 1h-1.5v3H6v-3.2H4.5L1 14z" fill="currentColor"/><rect x="5" y="14" width="6" height="4" rx="1" fill="currentColor" opacity=".8"/>'),
  sniper:SV('<path d="M0.5 13l4-1.6 2-1.4h9.5l2-.6H23v1.4h-5l-1.6 1.2H11l-.6 4.5H8.2l.6-4.2H6l-2.5 1.6H.5z" fill="currentColor"/><rect x="8" y="6.6" width="8" height="2.4" rx="1.2" fill="currentColor"/>'),
  dualdagger:SV('<path d="M5 3.5l2.2 8-2.5 3.2-1.4-3.4z" fill="currentColor"/><path d="M4.8 15l-.5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M17.5 3.5l-2.2 8 2.5 3.2 1.4-3.4z" fill="currentColor"/><path d="M17.7 15l.5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  spear:SV('<path d="M20.5 2.5l-1.2 5.2-2-2z" fill="currentColor"/><path d="M18 6.2L3 21.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>')
};
