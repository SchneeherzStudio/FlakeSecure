/**
 * ============================================================================
 * FlakeSecure - Yuki Mascot Pose Registry
 * ============================================================================
 */

export const YUKI = {
  sit: require('../../../../assets/yuki/yuki_sit-1.webp'),
  wave: require('../../../../assets/yuki/yuki_klick.webp'),
  klick: require('../../../../assets/yuki/yuki_klick.webp'),
  peek: require('../../../../assets/yuki/yuki_peek.webp'),
  stand: require('../../../../assets/yuki/yuki_stand.webp'),
  walk: require('../../../../assets/yuki/yuki_walk.webp'),
  jump: require('../../../../assets/yuki/yuki_jump.webp'),
  play: require('../../../../assets/yuki/yuki_play.webp'),
  butterfly: require('../../../../assets/yuki/yuki_butterfly.webp'),
  fish: require('../../../../assets/yuki/yuki_fish.webp'),
  stretch: require('../../../../assets/yuki/yuki_stretch.webp'),
  relax: require('../../../../assets/yuki/yuki_relax.webp'),
  sleep: require('../../../../assets/yuki/yuki_sleep.webp'),
  head: require('../../../../assets/yuki/yuki_head.webp'),
};

export function getYukiPose(pose) {
  return YUKI[pose] || YUKI.sit;
}
