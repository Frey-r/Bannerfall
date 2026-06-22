import { ActionLog, DeckSnapshot } from '../types/index.ts';
import { RUN_TURNS } from './balance.ts';

export function validateActionLog(deckSnapshot: DeckSnapshot, actionLog: ActionLog): { isValid: boolean; error?: string } {
  if (!Array.isArray(deckSnapshot) || deckSnapshot.length === 0) {
    return { isValid: false, error: 'El deckSnapshot debe ser un arreglo no vacío.' };
  }

  if (!Array.isArray(actionLog)) {
    return { isValid: false, error: 'El actionLog debe ser un arreglo.' };
  }

  if (actionLog.length !== RUN_TURNS) {
    return { isValid: false, error: `El actionLog debe tener exactamente ${RUN_TURNS} acciones.` };
  }

  const validAffinities = new Set(['OFE', 'DEF', 'MAN']);
  const advisorIds = new Set(deckSnapshot.map(c => c.id));

  for (let i = 0; i < actionLog.length; i++) {
    const action = actionLog[i];
    if (!action || typeof action !== 'object') {
      return { isValid: false, error: `La acción en el índice ${i} no es válida.` };
    }

    if (!validAffinities.has(action.choice)) {
      return { isValid: false, error: `La opción '${action.choice}' en el índice ${i} es inválida.` };
    }

    if (!advisorIds.has(action.consejeroId)) {
      return { isValid: false, error: `El consejero '${action.consejeroId}' en el índice ${i} no pertenece al deckSnapshot.` };
    }
  }

  return { isValid: true };
}
