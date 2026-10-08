export const errors = {
  'errors.storage.notObject': 'State is not an object.',
  'errors.storage.newerVersion': 'This backup was made by a newer version of Adilingo (schema v{version}).',
  'errors.storage.unreadable': 'Saved progress could not be read ({reason}). A copy was kept under “{storageKey}”.',
  'errors.backup.invalidJson': 'The file is not valid JSON.',
  'errors.backup.notBackup': 'This does not look like an Adilingo backup.',
} as const;
