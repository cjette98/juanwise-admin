/**
 * Every bundled image is imported here rather than referenced by path, so Vite
 * fingerprints it and a moved feature folder never breaks a picture. Same
 * arrangement as juanwise-app-v2 `src/shared/assets/images.ts`; the files
 * themselves are copies of the game's assets.
 */
import appIcon from './icon.jpg';
import welcomeIcon from './welcomeicon.png';
import splash from './splash.jpg';
import welcomeBackground from './welcomebackground.jpg';
import catHistory from './history.jpg';
import catCulture from './ct.jpg';
import catGeography from './geography.jpg';
import catFestival from './fa.jpg';
import catNational from './ns.jpg';
import catHeroes from './fh.jpg';
import katipunan from './kkk.jpg';
import tinikling from './tinikling.jpg';
import riceTerraces from './ricefield.jpg';
import flag from './flag.jpg';
import rizal from './rizal.jpg';

export const images = {
  appIcon,
  welcomeIcon,
  splash,
  welcomeBackground,
  catHistory,
  catCulture,
  catGeography,
  catFestival,
  catNational,
  catHeroes,
  katipunan,
  tinikling,
  riceTerraces,
  flag,
  rizal,
};

/**
 * The picture the game falls back to for a category the admin has not given
 * one — mirrors juanwise-app-v2 `shared/content/category-content.ts`, so the
 * jigsaw preview here shows what a student would actually see.
 */
export const fallbackJigsawImage: Record<string, string> = {
  history: katipunan,
  culture: tinikling,
  geography: riceTerraces,
  festival: tinikling,
  national: flag,
  heroes: rizal,
};

export const categoryTile: Record<string, string> = {
  history: catHistory,
  culture: catCulture,
  geography: catGeography,
  festival: catFestival,
  national: catNational,
  heroes: catHeroes,
};

export default images;
