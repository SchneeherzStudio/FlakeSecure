/**
 * ============================================================================
 * FlakeSecure - Declarative Coach-Mark Tutorial Steps
 * ============================================================================
 */

export const TOUR_STORAGE_KEYS = {
  homePending: 'tutorial_home_pending',
  homeDone: 'tutorial_home_done_v1',
  authenticatorDone: 'tutorial_authenticator_done_v1',
  credentialsDone: 'tutorial_credentials_done_v1',
};

export const TOURS = {
  home: [
    {
      id: 'intro',
      target: null,
      pose: 'wave',
      titleKey: 'tutorial.home.introTitle',
      textKey: 'tutorial.home.intro',
    },
    {
      id: 'scan',
      target: 'home.scan',
      pose: 'klick',
      titleKey: 'tutorial.home.scanTitle',
      textKey: 'tutorial.home.scan',
    },
    {
      id: 'quick2fa',
      target: 'home.quick.2fa',
      pose: 'sit',
      titleKey: 'tutorial.home.quick2faTitle',
      textKey: 'tutorial.home.quick2fa',
    },
    {
      id: 'quickLogs',
      target: 'home.quick.logs',
      pose: 'head',
      titleKey: 'tutorial.home.quickLogsTitle',
      textKey: 'tutorial.home.quickLogs',
    },
    {
      id: 'quickNew',
      target: 'home.quick.new',
      pose: 'play',
      titleKey: 'tutorial.home.quickNewTitle',
      textKey: 'tutorial.home.quickNew',
    },
    {
      id: 'quickShare',
      target: 'home.quick.share',
      pose: 'fish',
      titleKey: 'tutorial.home.quickShareTitle',
      textKey: 'tutorial.home.quickShare',
    },
    {
      id: 'segments',
      target: 'home.segments',
      pose: 'walk',
      titleKey: 'tutorial.home.segmentsTitle',
      textKey: 'tutorial.home.segments',
    },
    {
      id: 'search',
      target: 'home.search',
      pose: 'peek',
      titleKey: 'tutorial.home.searchTitle',
      textKey: 'tutorial.home.search',
    },
    {
      id: 'sort',
      target: 'home.sort',
      pose: 'stretch',
      titleKey: 'tutorial.home.sortTitle',
      textKey: 'tutorial.home.sort',
    },
    {
      id: 'categories',
      target: 'home.categories',
      pose: 'butterfly',
      titleKey: 'tutorial.home.categoriesTitle',
      textKey: 'tutorial.home.categories',
      prepare: ({ setSegment }) => setSegment?.('logins'),
    },
    {
      id: 'breach',
      target: 'home.breach',
      pose: 'head',
      titleKey: 'tutorial.home.breachTitle',
      textKey: 'tutorial.home.breach',
      optional: true,
    },
    {
      id: 'mainAction',
      target: ['home.emptyAdd', 'home.firstItem'],
      pose: 'klick',
      titleKey: 'tutorial.home.emptyAddTitle',
      textKey: 'tutorial.home.emptyAdd',
      optional: true,
    },
    {
      id: 'restore',
      target: 'home.restore',
      pose: 'sit',
      titleKey: 'tutorial.home.restoreTitle',
      textKey: 'tutorial.home.restore',
      optional: true,
    },
    {
      id: 'userBadge',
      target: 'home.userBadge',
      pose: 'jump',
      titleKey: 'tutorial.home.userBadgeTitle',
      textKey: 'tutorial.home.userBadge',
    },
  ],
  authenticator: [
    {
      id: 'authAdd',
      target: 'auth.add',
      pose: 'klick',
      titleKey: 'tutorial.authenticator.addTitle',
      textKey: 'tutorial.authenticator.add',
    },
    {
      id: 'authTimer',
      target: 'auth.timer',
      pose: 'sit',
      titleKey: 'tutorial.authenticator.timerTitle',
      textKey: 'tutorial.authenticator.timer',
    },
    {
      id: 'authList',
      target: ['auth.firstRow', 'auth.emptyAdd'],
      pose: 'play',
      titleKey: 'tutorial.authenticator.listTitle',
      textKey: 'tutorial.authenticator.list',
      optional: true,
    },
  ],
  credentials: [
    {
      id: 'credType',
      target: 'cred.typeSwitcher',
      pose: 'walk',
      titleKey: 'tutorial.credentials.typeSwitcherTitle',
      textKey: 'tutorial.credentials.typeSwitcher',
    },
    {
      id: 'credCategory',
      target: 'cred.category',
      pose: 'butterfly',
      titleKey: 'tutorial.credentials.categoryTitle',
      textKey: 'tutorial.credentials.category',
      optional: true,
    },
    {
      id: 'credSave',
      target: 'cred.save',
      pose: 'jump',
      titleKey: 'tutorial.credentials.saveTitle',
      textKey: 'tutorial.credentials.save',
    },
  ],
};
