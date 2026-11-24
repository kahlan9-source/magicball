/** A local, dependency-free studio-lit sphere. No network assets or GPU framework. */
const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUV;
void main() { vUV = aPosition; gl_Position = vec4(aPosition, 0.0, 1.0); }
`;
const FRAGMENT = `
precision highp float;
varying vec2 vUV;
uniform vec2 uRotation;
uniform float uReveal;
uniform sampler2D uEight;
uniform sampler2D uAnswer;
float band(float x, float lo, float hi, float feather) {
  return smoothstep(lo-feather, lo+feather, x) * (1.0-smoothstep(hi-feather, hi+feather, x));
}
vec3 studio(vec3 r) {
  // Two large photographic softboxes, a warm rim, and a dim blue fill.
  float key = band(r.x, -.91, -.22, .045) * band(r.y, .22, .91, .065) * smoothstep(-.05,.35,r.z);
  float strip = band(r.x, .69, .81, .028) * band(r.y, -.35,.60,.12) * smoothstep(-.25,.2,r.z);
  float ceiling = pow(max(0.0, dot(r, normalize(vec3(-.1,1.0,.3)))), 18.0);
  float fill = pow(max(0.0, dot(r, normalize(vec3(.7,-.2,.5)))), 8.0);
  return vec3(.014,.018,.028) + vec3(.90,.94,1.0)*key*.85 + vec3(.82,.66,.40)*strip*.48 + vec3(.42,.48,.60)*ceiling*.33 + vec3(.07,.11,.20)*fill*.26;
}
void main() {
  vec2 p = vUV * 1.13;
  float rr = dot(p,p);
  if (rr > 1.0) { gl_FragColor = vec4(0.0); return; }
  vec3 n = vec3(p, sqrt(max(0.0, 1.0-rr)));
  float cy=cos(uRotation.x), sy=sin(uRotation.x), cx=cos(uRotation.y), sx=sin(uRotation.y);
  vec3 local = vec3(cy*n.x-sy*n.z, n.y, sy*n.x+cy*n.z);
  local = vec3(local.x,cx*local.y+sx*local.z,-sx*local.y+cx*local.z);
  vec3 eye=vec3(0.0,0.0,1.0);
  vec3 reflected = reflect(-eye,n);
  float fresnel=.045+.72*pow(1.0-n.z,5.0);
  float key=max(0.0,dot(n,normalize(vec3(-.55,.80,1.0))));
  vec3 color=vec3(.019,.023,.033)*(.45+.65*key);
  color+=studio(reflected)*(.36+fresnel);
  // A fine rim catches the studio light around the polished black shell.
  color+=vec3(.14,.17,.22)*pow(1.0-n.z,3.5)*(.15+.35*max(n.y,0.0));
  float radius=length(local.xy);
  if(local.z>.0 && radius<.482) {
    float edge=1.0-smoothstep(.461,.482,radius);
    vec2 uv=local.xy/.94+.5;
    vec3 ivory=texture2D(uEight,uv).rgb;
    ivory*=.74+.26*key;
    ivory+=studio(reflected)*.13;
    color=mix(color,ivory,edge);
  }
  if(local.z<.0 && radius<.665) {
    float outer=1.0-smoothstep(.652,.665,radius);
    float lip=1.0-smoothstep(.622,.643,radius);
    vec3 rim=vec3(.075,.085,.11)*(.6+.7*key)+studio(reflected)*.27;
    vec2 uv=vec2(-local.x,local.y)/1.25+.5;
    vec3 glass=texture2D(uAnswer,uv).rgb;
    // The die emerges through dark blue fluid as the sphere settles.
    glass=mix(vec3(.007,.018,.065),glass,uReveal);
    glass+=studio(reflected)*.065;
    color=mix(color,mix(rim,glass,lip),outer);
  }
  float alpha=1.0-smoothstep(.994,1.0,rr);
  // Soft filmic display conversion keeps the black resin rich, not grey.
  color=pow(max(color,vec3(0.0)),vec3(.83));
  gl_FragColor=vec4(color,alpha);
}
`;

function makeTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  return canvas;
}

function paintEight(ctx, size) {
  const light = ctx.createRadialGradient(size*.32,size*.22,0,size*.5,size*.5,size*.7);
  light.addColorStop(0,'#fffdf3'); light.addColorStop(1,'#c6c6bd');
  ctx.fillStyle=light; ctx.fillRect(0,0,size,size);
  ctx.fillStyle='#11151b'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=`700 ${size*.79}px Georgia, "Times New Roman", serif`;
  ctx.fillText('8',size*.5,size*.53);
}

function wrapText(ctx, text, maxWidth) {
  const words=text.split(/\s+/), lines=[];
  for (const word of words) {
    const current=lines[lines.length-1];
    if (current && ctx.measureText(current+' '+word).width<=maxWidth) lines[lines.length-1]+=' '+word;
    else lines.push(word);
  }
  return lines;
}

// Measure real glyph bounds against the triangle's sloping edges.
export function fitAnswer(ctx, size, answer) {
  for (let font=size*.085; font>=size*.012; font-=size*.001) {
    ctx.font=`600 ${font}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    for (const width of [.36,.42,.48,.54,.60]) {
      const lines=wrapText(ctx,answer,size*width);
      const lineHeight=font*1.18, first=size*.63-(lines.length-1)*lineHeight/2;
      const fits=lines.every((line,i)=>{
        const m=ctx.measureText(line), y=first+i*lineHeight;
        const top=y-(m.actualBoundingBoxAscent ?? font*.6)-size*.012;
        const bottom=y+(m.actualBoundingBoxDescent ?? font*.6)+size*.012;
        const halfWidth=(top-size*.105)/(.84-.105)*.36-size*.018;
        return top>size*.105 && bottom<size*.82 &&
          Math.max(m.actualBoundingBoxLeft ?? m.width/2,m.actualBoundingBoxRight ?? m.width/2)<=halfWidth;
      });
      if (fits) return {font,lines,lineHeight,first};
    }
  }
  throw new Error('Answer cannot fit within the triangle');
}

function paintAnswer(ctx,size,answer) {
  const liquid=ctx.createRadialGradient(size*.48,size*.40,size*.02,size*.5,size*.5,size*.64);
  liquid.addColorStop(0,'#173c8a'); liquid.addColorStop(.65,'#071b4a'); liquid.addColorStop(1,'#010513');
  ctx.fillStyle=liquid; ctx.fillRect(0,0,size,size);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(size*.5,size*.105); ctx.lineTo(size*.86,size*.84); ctx.lineTo(size*.14,size*.84); ctx.closePath();
  ctx.shadowColor='#316bff'; ctx.shadowBlur=size*.05;
  const triangle=ctx.createLinearGradient(size*.2,size*.15,size*.8,size*.9);
  triangle.addColorStop(0,'#3775da'); triangle.addColorStop(.45,'#2554ad'); triangle.addColorStop(1,'#12387c');
  ctx.fillStyle=triangle; ctx.fill();
  ctx.shadowBlur=0; ctx.strokeStyle='rgba(119,172,255,.63)'; ctx.lineWidth=size*.004; ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle='#f4f7ff'; ctx.textAlign='center'; ctx.textBaseline='middle';
  const { font, lines, lineHeight, first } = fitAnswer(ctx, size, answer);
  ctx.font=`600 ${font}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.shadowColor='rgba(0,8,32,.8)'; ctx.shadowBlur=size*.008; ctx.shadowOffsetY=size*.003;
  lines.forEach((line,i)=>ctx.fillText(line,size*.5,first+i*lineHeight));
  ctx.restore();
  // An extremely subtle reflected arc gives the round window a glass surface.
  ctx.beginPath();ctx.ellipse(size*.5,size*.5,size*.48,size*.48,0,Math.PI*1.12,Math.PI*1.57);
  ctx.strokeStyle='rgba(147,185,255,.10)';ctx.lineWidth=size*.009;ctx.stroke();
}

export class OracleBall {
  constructor(canvas,{reducedMotion=false}={}) {
    this.canvas=canvas; this.reducedMotion=reducedMotion; this.rotation=0; this.pitch=0;
    this.revealAmount=1; this.answer=''; this.busy=false; this.destroyed=false; this.frame=0;
    this.eightCanvas=makeTexture(512,paintEight);
    this.answerCanvas=makeTexture(1024,(ctx,size)=>paintAnswer(ctx,size,''));
    try {
      this.gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power'});
      if(!this.gl) throw new Error('WebGL is unavailable');
      this.initGL(); canvas.dataset.renderer='webgl';
    } catch(error) { this.initFallback(); }
    this.onContextLost=(event)=>{event.preventDefault();if(!this.destroyed){this.initFallback();this.resize();}};
    this.onContextRestored=()=>{
      if(this.destroyed)return;
      try {
        this.gl=this.canvas.getContext('webgl');
        if(!this.gl)throw new Error('WebGL restoration failed');
        this.initGL();this.canvas.dataset.renderer='webgl';
        this.fallback?.remove();this.fallback=null;this.context=null;this.resize();
      } catch(error) {this.initFallback();this.resize();}
    };
    // Browsers suspend RAF while locked/backgrounded: settle so no stale spin
    // or unresolved consultation is waiting when the app returns to the screen.
    this.onVisibilityChange=()=>{if(document.hidden)this.finishAnimation?.();};
    canvas.addEventListener('webglcontextlost',this.onContextLost);
    canvas.addEventListener('webglcontextrestored',this.onContextRestored);
    document.addEventListener('visibilitychange',this.onVisibilityChange);
    this.observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>this.resize()):null;
    this.observer?.observe(canvas); this.resize();
  }
  initGL() {
    const gl=this.gl;
    const compile=(type,source)=>{
      const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(error);}
      return shader;
    };
    const vertex=compile(gl.VERTEX_SHADER,VERTEX),fragment=compile(gl.FRAGMENT_SHADER,FRAGMENT);
    const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    this.program=program;gl.useProgram(program);
    this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    this.uniforms={rotation:gl.getUniformLocation(program,'uRotation'),reveal:gl.getUniformLocation(program,'uReveal')};
    this.textures=[this.eightCanvas,this.answerCanvas].map((source,i)=>{
      const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
      gl.uniform1i(gl.getUniformLocation(program,i?'uAnswer':'uEight'),i);return texture;
    });
  }
  initFallback() {
    this.gl=null;
    if(!this.fallback) {
      this.fallback=document.createElement('canvas'); this.fallback.setAttribute('aria-hidden','true');
      this.fallback.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
      const parent=this.canvas.parentElement;
      if(getComputedStyle(parent).position==='static')parent.style.position='relative';
      parent.appendChild(this.fallback); this.context=this.fallback.getContext('2d');
    }
    this.canvas.dataset.renderer='canvas2d';
  }
  resize() {
    if(this.destroyed)return;
    const bounds=this.canvas.getBoundingClientRect();
    const size=Math.max(1,Math.round((bounds.width||340)*Math.min(window.devicePixelRatio||1,2.5)));
    if(this.canvas.width!==size||this.canvas.height!==size){this.canvas.width=this.canvas.height=size;}
    if(this.fallback){this.fallback.width=this.fallback.height=size;}
    if(this.gl)this.gl.viewport(0,0,size,size);
    this.draw();
  }
  draw() {
    if(this.destroyed)return;
    if(!this.gl){this.drawFallback();return;}
    const gl=this.gl;gl.useProgram(this.program);gl.uniform2f(this.uniforms.rotation,this.rotation,this.pitch);gl.uniform1f(this.uniforms.reveal,this.revealAmount);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  drawFallback() {
    const ctx=this.context;if(!ctx)return;
    const size=this.fallback.width,r=size/2.26,c=size/2;
    ctx.clearRect(0,0,size,size);ctx.save();ctx.translate(c,c);
    const resin=ctx.createRadialGradient(-r*.38,-r*.48,r*.05,0,0,r);
    resin.addColorStop(0,'#727782');resin.addColorStop(.22,'#303641');resin.addColorStop(.62,'#10151f');resin.addColorStop(.93,'#03050a');resin.addColorStop(1,'#252a35');
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=resin;ctx.fill();
    const facing=Math.cos(this.rotation), front=facing>=0, radius=r*(front?.47:.65);
    ctx.save();ctx.scale(Math.max(.015,Math.abs(facing)),1);ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.clip();
    if(front)ctx.drawImage(this.eightCanvas,-radius,-radius,radius*2,radius*2);
    else {ctx.fillStyle='#071b4a';ctx.fillRect(-radius,-radius,2*radius,2*radius);ctx.globalAlpha=this.revealAmount;ctx.drawImage(this.answerCanvas,-radius,-radius,radius*2,radius*2);}
    ctx.restore();ctx.restore();
  }
  setReducedMotion(value) {this.reducedMotion=Boolean(value);}
  async reveal(answer) {
    if(this.busy||this.destroyed)return;
    this.busy=true;this.answer=answer;
    paintAnswer(this.answerCanvas.getContext('2d'),this.answerCanvas.width,answer);
    if(this.gl){const gl=this.gl;gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.textures[1]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.answerCanvas);}
    const start=this.rotation, end=this.answerShown?start+Math.PI*2:Math.PI*3;
    const duration=this.reducedMotion?0:1550;
    const finish=()=>{this.rotation=Math.PI;this.pitch=0;this.revealAmount=1;this.answerShown=true;this.busy=false;this.draw();};
    if(!duration){finish();return;}
    await new Promise(resolve=>{
      this.finishAnimation=()=>{cancelAnimationFrame(this.frame);finish();this.finishAnimation=null;resolve();};
      const beginning=performance.now();
      const tick=now=>{
        if(this.destroyed||this.reducedMotion){this.finishAnimation?.();return;}
        const t=Math.min(1,(now-beginning)/duration);
        // Accelerate gently, decelerate for a full second into the answer.
        const ease=t*t*t*(t*(t*6-15)+10);
        this.rotation=start+(end-start)*ease;
        this.pitch=Math.sin(t*Math.PI*4)*Math.sin(t*Math.PI)*.24;
        this.revealAmount=Math.max(0,Math.min(1,(t-.70)/.30));
        this.draw();
        if(t<1)this.frame=requestAnimationFrame(tick);else this.finishAnimation?.();
      };
      this.frame=requestAnimationFrame(tick);
    });
  }
  destroy() {
    if(this.destroyed)return;
    this.finishAnimation?.();this.destroyed=true;cancelAnimationFrame(this.frame);this.observer?.disconnect();
    this.canvas.removeEventListener('webglcontextlost',this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored',this.onContextRestored);
    document.removeEventListener('visibilitychange',this.onVisibilityChange);this.fallback?.remove();
    if(this.gl){this.textures?.forEach(texture=>this.gl.deleteTexture(texture));this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);}
    this.gl=null;this.textures=null;this.buffer=null;this.program=null;this.fallback=null;this.context=null;
  }
}
