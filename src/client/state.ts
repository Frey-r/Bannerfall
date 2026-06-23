/* ============================================================
   Estado de cliente compartido entre escenas Phaser.
   El servidor sigue siendo la única autoridad: esto es solo una
   caché de lo último devuelto por la API para pintar la UI.
   ============================================================ */
import { api } from './api.ts';
import type { General, Consejero, UserProfile } from '../shared/types/index.ts';

interface Store {
  profile: UserProfile | null;
  advisors: Consejero[];
  generals: General[];
  selectedGeneralId: string;
}

export const store: Store = {
  profile: null,
  advisors: [],
  generals: [],
  selectedGeneralId: '',
};

/** Recarga perfil, consejeros y generales del usuario actual. */
export async function loadUserData(): Promise<void> {
  store.profile = await api.get<UserProfile>('/api/profile');
  store.advisors = await api.get<Consejero[]>('/api/consejeros');
  store.generals = await api.get<General[]>('/api/run/generals');
  if (store.generals.length > 0 && !store.generals.some((g) => g.id === store.selectedGeneralId)) {
    store.selectedGeneralId = store.generals[0].id;
  }
}
