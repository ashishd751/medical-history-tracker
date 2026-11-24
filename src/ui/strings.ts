/**
 * Every string a user can read lives here (section 16) so translation is a later,
 * mechanical change rather than a hunt through components.
 */
export const strings = {
  app: {
    name: 'Medical History',
    disclaimer: 'Informational only, not medical advice.',
  },
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    back: 'Back',
    loading: 'Loading…',
    retry: 'Try again',
    yes: 'Yes',
    no: 'No',
  },
  errors: {
    unknown: 'Something went wrong. Please try again.',
    fileNotFound: 'That file could not be found on this device.',
    fileWrite: 'The file could not be saved. Check free space and try again.',
    db: 'The record could not be saved. Please try again.',
    permissionDenied: 'Permission was denied. You can change this in system settings.',
    importInvalid: 'That backup file could not be read. Nothing was changed.',
    backupChecksum: 'The backup file is damaged or incomplete. Nothing was changed.',
  },
  dev: {
    galleryTitle: 'Design system',
    galleryHint: 'Throwaway screen for the Phase 0 visual parity spike.',
  },
} as const;

export type Strings = typeof strings;
