/** The sidebar, and the source of every page's title in the top bar. */
export interface NavItem {
  path: string;
  label: string;
  icon: string;
  title: string;
  subtitle: string;
  section: 'Manage' | 'Content';
}

export const NAV: NavItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: '🏠',
    title: 'Dashboard',
    subtitle: 'Everything registered on JuanWise at a glance',
    section: 'Manage',
  },
  {
    path: '/teachers',
    label: 'Teachers',
    icon: '🧑‍🏫',
    title: 'Teachers',
    subtitle: 'Every teacher account and the classes they own',
    section: 'Manage',
  },
  {
    path: '/students',
    label: 'Students',
    icon: '🎓',
    title: 'Students',
    subtitle: 'Every student, with the teacher and class code they joined',
    section: 'Manage',
  },
  {
    path: '/leaderboard',
    label: 'Leaderboard',
    icon: '🏆',
    title: 'Leaderboard',
    subtitle: 'Guests, and the top 10 of every class',
    section: 'Manage',
  },
  {
    path: '/quiz',
    label: 'Quiz',
    icon: '📝',
    title: 'Quiz Content',
    subtitle: 'Author the question, choices and correct answer for each activity',
    section: 'Content',
  },
  {
    path: '/jigsaw',
    label: 'Jigsaw',
    icon: '🧩',
    title: 'Jigsaw Content',
    subtitle: 'The picture the game cuts into a puzzle, its mini-lesson and its definition',
    section: 'Content',
  },
];

export const navForPath = (pathname: string): NavItem | undefined =>
  NAV.find((item) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)));
