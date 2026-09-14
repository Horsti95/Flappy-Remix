import { describe, expect, it, vi, afterEach } from "vitest";
import sharp from "sharp";
import { studioHome } from "../src/ui/studio-home";
import type { MenuMeta } from "../src/ui/menu";
import { getShape, DEFAULT_SHAPE_ID } from "../src/game/shapes";
import { getTheme, DEFAULT_THEME_ID } from "../src/game/themes";
import { getPillarStyle, DEFAULT_PILLAR_STYLE } from "../src/game/pillars";
import { getSpriteFrame } from "../src/game/sprite-layout";

const meta: MenuMeta = {accountLabel:"offline",daily:null,streakDays:0};
afterEach(() => vi.unstubAllGlobals());
describe("Paper Studio interface", () => {
  it("retains every real destination, including Journey and customization", () => {
    const html=studioHome(meta);
    for(const action of ["play","daily","ranked","training","skins","leaderboard","quests","friends","inbox","customize"])
      expect(html.match(new RegExp(`data-action="${action}"`,"g"))).toHaveLength(1);
    expect(html).toContain("data-settings"); expect(html).toContain("data-account");
  });
  it("calls the unconfigured account a local pilot without claiming cloud sync", () => {
    const html=studioHome(meta);
    expect(html).toContain("Local pilot");expect(html).toContain("Offline · play locally");
    expect(html).not.toContain("Ready for takeoff");expect(html).not.toContain("100,000");
  });
  it("escapes user names and daily text before interpolating markup", () => {
    const html=studioHome({...meta,accountLabel:'<img src=x onerror="alert(1)">',daily:{date:"2026-09-13",playsCount:1,tier:"medium",modifierNames:[],modifierBlurbs:['<script>alert("test")</script>']}});
    expect(html).not.toContain('<img src=x');expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');
  });
  it("previews the existing loadout without overwriting it", () => {
    const html=studioHome({...meta,equippedShape:"pack-koi",equippedTheme:"paper-japan",equippedSkin:{body:[100,120,110],accent:[150,170,160]}});
    expect(html).toContain("/sprites/pack-koi.png");expect(html).toContain("/backgrounds/paper-japan.webp");
  });
  it("honors the menu-preview preference and bounds inbox badges", () => {
    const html=studioHome({...meta,equippedShape:"pack-koi",equippedTheme:"paper-japan",showEquippedInMenu:false,inboxUnseen:999});
    expect(html).toContain("studio-swift.png");expect(html).toContain("studio-meadow.webp");expect(html).not.toContain("pack-koi.png");expect(html).toContain("9+");
  });
  it("shows pending submissions honestly and decorates icons accessibly", () => {
    const html=studioHome({...meta,accountLabel:"Pilot",online:true,pendingSubmissions:2});
    expect(html).toContain("Sync pending");expect(html).toContain("2 runs waiting");expect(html).toContain('aria-label="Explore Glide"');expect(html).toContain('aria-hidden="true" class="studio-icon"');
  });
  it("uses a new default look but preserves the legacy identities", () => {
    expect(DEFAULT_SHAPE_ID).toBe("studio-swift");expect(DEFAULT_THEME_ID).toBe("studio-meadow");expect(DEFAULT_PILLAR_STYLE).toBe("studio-fold");
    expect(getShape("paper-plane").id).toBe("paper-plane");expect(getTheme("sunny").id).toBe("sunny");expect(getPillarStyle("solid").id).toBe("solid");
  });
  it("keeps the Studio pillar gap and contrast silhouette identical", () => {
    for(const hc of [false,true]){
      const ctx={fillRect:vi.fn()};
      getPillarStyle("studio-fold").draw({ctx:ctx as unknown as CanvasRenderingContext2D,x:200,gapY:200,gapH:170,pipeWidth:56,worldHeight:640,over:0,bodyColor:"#789587",capColor:"#e0cfaa",highContrast:hc});
      const calls=ctx.fillRect.mock.calls;
      expect(calls.slice(0,4)).toEqual([[200,-0,56,200],[200,370,56,270],[197,186,62,14],[197,370,62,14]]);
      for(const [,y,,h] of calls)expect(y+h<=200||y>=370).toBe(true);
    }
  });
  it("exports a transparent aligned sprite with the same 35px longest edge", async () => {
    const bounds={x0:256,y0:256,x1:-1,y1:-1};
    for(const suffix of ["","-accent"]){
      const {data,info}=await sharp(`public/sprites/studio-swift${suffix}.png`).raw().toBuffer({resolveWithObject:true});
      expect([info.width,info.height,info.channels]).toEqual([256,256,4]);expect(data[3]).toBe(0);
      let pixels=0;
      for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(data[(y*256+x)*4+3]>16){pixels++;bounds.x0=Math.min(bounds.x0,x);bounds.x1=Math.max(bounds.x1,x);bounds.y0=Math.min(bounds.y0,y);bounds.y1=Math.max(bounds.y1,y)}
      expect(pixels).toBeGreaterThan(200);
    }
    const f=getSpriteFrame(256,256,{x:bounds.x0/256,y:bounds.y0/256,w:(bounds.x1-bounds.x0+1)/256,h:(bounds.y1-bounds.y0+1)/256},14);
    expect(Math.max(f.dw,f.dh)).toBeCloseTo(35);expect(f.dx+f.dw/2).toBe(0);expect(f.dy+f.dh/2).toBe(0);
    const bg=await sharp("public/backgrounds/studio-meadow.webp").metadata();expect(bg.format).toBe("webp");expect(bg.height!).toBeGreaterThan(bg.width!);
  });
});
