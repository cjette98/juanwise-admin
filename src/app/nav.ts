/** The sidebar, and the source of every page's title in the top bar. */
export interface NavItem {
  path: string;
  label: string;
  icon: string;
  title: string;
  subtitle: string;
  section: 'Manage' | 'Content';
  roles: ('admin' | 'teacher')[];
}

export const NAV: NavItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: '🏠',
    title: 'Dashboard',
    subtitle: 'Everything registered on JuanWise at a glance',
    section: 'Manage',
    roles: ['admin'],
  },
  {
    path: '/teachers',
    label: 'Teachers',
    icon: '🧑‍🏫',
    title: 'Teachers',
    subtitle: 'Every teacher account and the classes they own',
    section: 'Manage',
    roles: ['admin'],
  },
  {
    path: '/students',
    label: 'Students',
    icon: '🎓',
    title: 'Students',
    subtitle: 'Every student, with the teacher and class code they joined',
    section: 'Manage',
    roles: ['admin'],
  },
  {
    path: '/leaderboard',
    label: 'Leaderboard',
    icon: '🏆',
    title: 'Leaderboard',
    subtitle: 'Guests, and the top 10 of every class',
    section: 'Manage',
    roles: ['admin'],
  },
  {
    path: '/packs',
    label: 'Packs',
    icon: '📦',
    title: 'Content Packs',
    subtitle: 'Build, duplicate and publish the activities your classes play',
    section: 'Content',
    roles: ['admin', 'teacher'],
  },
  {
    path: '/my-classes',
    label: 'My Classes',
    icon: '🏫',
    title: 'My Classes',
    subtitle: 'The classes you handle, and which pack each one plays',
    section: 'Manage',
    roles: ['teacher'],
  },
];

export const navForPath = (pathname: string): NavItem | undefined =>
  NAV.find((item) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)));
