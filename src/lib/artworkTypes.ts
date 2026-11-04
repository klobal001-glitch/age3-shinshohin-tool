export const ARTWORK_PART_SIZE=3*1024*1024;
export const ARTWORK_MAX_SIZE=30*1024*1024;
export interface ArtworkPart {size:number;sha256:string}
export interface ArtworkManifest {
  version:1;id:string;source:string;createdAt:string;mime:string;size:number;
  width:number;height:number;parts:ArtworkPart[];preview:ArtworkPart;
}
export interface SavedArtwork {manifest:ArtworkManifest;previewUrl:string;urls?:string[]}
export interface ArtworkReport {createdAt:string;total:number;done:number;saved:number;bytes:number;errors:Array<{product:string;name:string;error:string}>}
export const artworkIdPattern=/^[a-f0-9]{64}$/;
export function artworkSource(raw:string):string {
  const s=raw.trim();
  if(/^inside:artwork\/[a-f0-9-]{36}\/[^/]{1,300}$/.test(s))return s;
  if(s.startsWith('/')&&!s.startsWith('//')&&!s.includes('\\'))return s;
  try {const u=new URL(s);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port)return u.href;}catch{}
  return '';
}
export function validateArtwork(value:unknown):ArtworkManifest {
  const m=value as ArtworkManifest;
  const part=(p:ArtworkPart,max:number)=>p&&Number.isInteger(p.size)&&p.size>0&&p.size<=max&&artworkIdPattern.test(p.sha256);
  if(!m||m.version!==1||!artworkIdPattern.test(m.id)||!m.source||artworkSource(m.source)!==m.source||m.source.length>4096||
    !/^image\/(png|jpeg|webp)$/.test(m.mime)||!Number.isInteger(m.size)||m.size<1||m.size>ARTWORK_MAX_SIZE||
    !Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<1||m.height<1||m.width*m.height>60_000_000||
    !Number.isFinite(Date.parse(m.createdAt))||!Array.isArray(m.parts)||m.parts.length!==Math.ceil(m.size/ARTWORK_PART_SIZE)||
    !m.parts.every((p,i)=>part(p,ARTWORK_PART_SIZE)&&p.size===(i<m.parts.length-1?ARTWORK_PART_SIZE:m.size-i*ARTWORK_PART_SIZE))||
    !part(m.preview,512*1024))throw new Error('画像の保存情報を確認してください。');
  return {version:1,id:m.id,source:m.source,createdAt:m.createdAt,mime:m.mime,size:m.size,width:m.width,height:m.height,parts:m.parts.map(p=>({size:p.size,sha256:p.sha256})),preview:{size:m.preview.size,sha256:m.preview.sha256}};
}
export function artworkPath(id:string,index:number|'preview') {
  if(!artworkIdPattern.test(id)||!(index==='preview'||Number.isInteger(index)&&index>=0&&index<10))throw new Error('保存番号を確認してください。');
  return `artwork/files/${id}/${index}.bin`;
}
