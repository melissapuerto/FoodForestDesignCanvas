/**
 * Chaac guided tour
 * -----------------
 * A first-run (and replayable) walkthrough of the canvas, narrated by Chaac —
 * the Maya rain deity shown in the app icon. Built on driver.js, themed to the
 * códice look in ./chaac-tour.css. All copy comes from the i18n dictionaries so
 * the tour speaks whichever language the rest of the app is in.
 */
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import './chaac-tour.css';
import { t } from '../i18n/index.svelte';


// The completed-flag lives in tourFlag.ts so the shell can read it without
// loading driver.js. Re-exported for existing imports.
export { tourCompleted, markTourCompleted } from './tourFlag';
import { markTourCompleted } from './tourFlag';

type Side = 'top' | 'right' | 'bottom' | 'left';
type Align = 'start' | 'center' | 'end';

/** A step bound to a `[data-tour="…"]` anchor. */
function at(
  anchor: string,
  titleKey: string,
  descKey: string,
  side: Side = 'bottom',
  align: Align = 'center'
): DriveStep {
  return {
    element: `[data-tour="${anchor}"]`,
    popover: {
      title: t(titleKey as never),
      description: t(descKey as never),
      side,
      align
    }
  };
}

/** A centred step with no spotlight (welcome / farewell). */
function centered(titleKey: string, descKey: string): DriveStep {
  return {
    popover: {
      title: t(titleKey as never),
      description: t(descKey as never),
      align: 'center'
    }
  };
}

/**
 * Build, then start, the guided tour.
 * Steps whose anchor is not currently in the DOM are skipped so the tour never
 * stalls on a hidden control.
 */
export function startChaacTour(opts: { onDone?: () => void } = {}): void {
  const planned: DriveStep[] = [
    centered('tour_welcome_title', 'tour_welcome_desc'),
    at('canvas', 'tour_canvas_title', 'tour_canvas_desc', 'top', 'center'),
    at('tools', 'tour_tools_title', 'tour_tools_desc', 'right', 'center'),
    at('identity', 'tour_identity_title', 'tour_identity_desc', 'bottom', 'start'),
    at('basemap', 'tour_basemap_title', 'tour_basemap_desc', 'bottom', 'center'),
    at('suggestions', 'tour_suggestions_title', 'tour_suggestions_desc', 'bottom', 'center'),
    at('notifications', 'tour_notifications_title', 'tour_notifications_desc', 'bottom', 'end'),
    at('tweaks', 'tour_tweaks_title', 'tour_tweaks_desc', 'bottom', 'end'),
    at('nav', 'tour_nav_title', 'tour_nav_desc', 'top', 'center'),
    at('help', 'tour_help_title', 'tour_help_desc', 'bottom', 'end'),
    centered('tour_done_title', 'tour_done_desc')
  ];

  // Keep centred steps; keep anchored steps only when their element exists.
  const steps = planned.filter((s) => {
    if (!s.element) return true;
    return !!document.querySelector(s.element as string);
  });

  const d = driver({
    showProgress: true,
    progressText: t('tour_progress' as never), // "{{current}} / {{total}}"
    overlayColor: 'oklch(0.20 0.04 60 / 0.62)',
    overlayOpacity: 1,
    stagePadding: 6,
    stageRadius: 10,
    smoothScroll: true,
    allowClose: true,
    disableActiveInteraction: true,
    popoverClass: 'chaac-popover',
    nextBtnText: t('tour_next' as never),
    prevBtnText: t('tour_prev' as never),
    doneBtnText: t('tour_done_btn' as never),
    steps,
    onDestroyed: () => {
      markTourCompleted();
      opts.onDone?.();
    }
  });

  d.drive();
}
