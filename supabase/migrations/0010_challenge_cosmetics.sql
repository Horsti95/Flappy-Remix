-- 0010: store the creator's cosmetics on a challenge so the responder can
-- see the real sender's world (shape + theme/sky/pillars) and "flex" — rather
-- than the ghost being painted with the responder's own shape.
--
-- Shape + theme are client equipped-state (localStorage), not on the run, so
-- we persist them on the challenge at creation time. Both are nullable: older
-- challenges (and any created without them) fall back to defaults on render.
--
-- Cosmetic only — does not affect physics or scoring (collision uses a fixed
-- bird radius, independent of shape).

alter table public.challenges
  add column if not exists creator_shape text,
  add column if not exists creator_theme text;
