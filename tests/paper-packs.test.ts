import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { PAPER_PACKS } from "../src/game/paper-packs";
import { getShape } from "../src/game/shapes";
import { getTheme } from "../src/game/themes";
import { getPillarStyle } from "../src/game/pillars";
import { getPreset } from "../src/game/preset-skins";
import { getBackgroundSource } from "../src/game/backgrounds";
import { hasAccentLayer, hasSprite } from "../src/game/sprites";
import { getSpriteFrame } from "../src/game/sprite-layout";
import { DEFAULT_CONFIG } from "../src/game/config";
import type { AchievementStats } from "../src/game/achievements";

describe("paper-world local drafts", () => {
  it("has eight distinct sets with no shared component ids", () => {
    expect(PAPER_PACKS).toHaveLength(8);
    for (const key of ["id", "shapeId", "presetId"] as const)
      expect(new Set(PAPER_PACKS.map(p => p[key])).size).toBe(8);
  });
  it.each(PAPER_PACKS)("registers every component of $id and leaves it free for testing", pack => {
    const shape = getShape(pack.shapeId), theme = getTheme(pack.id), pillar = getPillarStyle(pack.id), preset = getPreset(pack.presetId)!;
    expect(shape.id).toBe(pack.shapeId); expect(theme.id).toBe(pack.id); expect(pillar.id).toBe(pack.id);
    expect(preset.body).toEqual(pack.body); expect(preset.accent).toEqual(pack.accent);
    expect(hasSprite(pack.shapeId) && hasAccentLayer(pack.shapeId)).toBe(true);
    expect(pillar.hardensDaily).toBe(false);
    for (const component of [shape, theme, pillar, preset])
      expect(component.unlock({} as AchievementStats).unlocked).toBe(true);
    expect(getBackgroundSource(theme.backgroundImage!)).toBe(`/backgrounds/${pack.id}.webp`);
  });
  it.each(PAPER_PACKS)("has compact art, real alpha and a fair normalized sprite for $id", async pack => {
    const bg = await sharp(`public/backgrounds/${pack.id}.webp`).metadata();
    expect(bg.width).toBeLessThanOrEqual(1080); expect(bg.height!).toBeGreaterThan(bg.width!);
    const crop = {x0:256,y0:256,x1:-1,y1:-1};
    for (const suffix of ["", "-accent"]) {
      const {data,info} = await sharp(`public/sprites/${pack.shapeId}${suffix}.png`).raw().toBuffer({resolveWithObject:true});
      expect([info.width,info.height,info.channels]).toEqual([256,256,4]); expect(data[3]).toBe(0);
      let pixels = 0, outside = 0;
      for (let y=0;y<256;y++) for(let x=0;x<256;x++) {
        if(data[(y*256+x)*4+3] <=16) continue;
        pixels++;
        if (!suffix) { crop.x0=Math.min(crop.x0,x);crop.x1=Math.max(crop.x1,x);crop.y0=Math.min(crop.y0,y);crop.y1=Math.max(crop.y1,y); }
        else if(x<crop.x0 || x>crop.x1 || y<crop.y0 || y>crop.y1) outside++;
      }
      expect(pixels).toBeGreaterThan(200); expect(outside).toBe(0);
    }
    const f=getSpriteFrame(256,256,{x:crop.x0/256,y:crop.y0/256,w:(crop.x1-crop.x0+1)/256,h:(crop.y1-crop.y0+1)/256},DEFAULT_CONFIG.birdRadius);
    expect(Math.max(f.dw,f.dh)).toBeCloseTo(35); expect(f.dx+f.dw/2).toBe(0); expect(f.dy+f.dh/2).toBe(0);
    expect(DEFAULT_CONFIG.birdRadius).toBe(14);
  });
  it.each(PAPER_PACKS)("keeps high-contrast pillar geometry identical for $id", pack => {
    const fillRect=vi.fn();
    getPillarStyle(pack.id).draw({ctx:{fillRect} as unknown as CanvasRenderingContext2D,
      x:200,gapY:220,gapH:170,worldHeight:640,pipeWidth:56,over:20,
      bodyColor:"#fff",capColor:"#ccc",highContrast:true});
    expect(fillRect.mock.calls).toEqual([[200,-20,56,240],[200,390,56,270],[197,206,62,14],[197,390,62,14]]);
  });
  it.each(PAPER_PACKS)("clips all decorative strokes to the two solid bodies for $id", pack => {
    const ctx={save:vi.fn(),restore:vi.fn(),beginPath:vi.fn(),rect:vi.fn(),clip:vi.fn(),
      fillRect:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn()};
    getPillarStyle(pack.id).draw({ctx:ctx as unknown as CanvasRenderingContext2D,
      x:200,gapY:220,gapH:170,worldHeight:640,pipeWidth:56,over:20,
      bodyColor:"#fff",capColor:"#ccc",highContrast:false});
    expect(ctx.rect.mock.calls).toEqual([[200,-20,56,240],[200,390,56,270]]);
    expect(ctx.clip).toHaveBeenCalledTimes(2); expect(ctx.save).toHaveBeenCalledTimes(2); expect(ctx.restore).toHaveBeenCalledTimes(2);
    const fills=ctx.fillRect.mock.calls;
    // Body planes are clipped; the final six rectangles are the caps and their inset lips.
    for(const [, y,, h] of fills.slice(-6)) expect(y+h<=220 || y>=390).toBe(true);
  });
});
