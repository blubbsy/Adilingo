import type { errors as en } from '../en/errors';

export const errors: Partial<Record<keyof typeof en, string>> = {
  'errors.storage.notObject': 'Der gespeicherte Zustand ist kein gültiges Objekt.',
  'errors.storage.newerVersion': 'Dieses Backup stammt von einer neueren Adilingo-Version (Schema v{version}).',
  'errors.storage.unreadable': 'Der gespeicherte Fortschritt konnte nicht gelesen werden ({reason}). Eine Kopie wurde unter „{storageKey}“ aufbewahrt.',
  'errors.backup.invalidJson': 'Die Datei ist kein gültiges JSON.',
  'errors.backup.notBackup': 'Das sieht nicht nach einem Adilingo-Backup aus.',
};
