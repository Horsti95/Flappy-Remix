import sharp from "sharp";
import {readFile} from "node:fs/promises";
import {prep} from "./prep-sprite-2color.mjs";
const art=JSON.parse(await readFile(new URL("../design/studio-audit/sources.json",import.meta.url),"utf8"));
for(const a of art){
  if(a.kind==="background") await sharp(a.source).resize({width:1080,withoutEnlargement:true}).webp({quality:88}).toFile(`public/backgrounds/${a.id}.webp`);
  else { const r=await prep(a.source,"public/sprites",a.id,{preserveAlpha:true}); if(!r.twoLayer)throw new Error("Missing accent layer"); }
}
