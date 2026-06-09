// =========================================================================
//  AprendIA -- Multi-API: Gemini + Unsplash + Pexels + Drive
//  Nuevas funciones: Documentos de referencia · Vídeo narrado · Guion completo
// =========================================================================

// --- ESTADO GLOBAL ---
let usuarioActivo = null;
let apiKeys = { gemini:"", unsplash:"", pexels:"", drive:"" };

let documentosReferencia = [];   // {nombre, tipo, base64, texto}
let datosCurriculares    = { tema:"", nivel:"", duracion:"", estilo:"" };
let listaApartados       = [];
let estructuraCompleta   = {};
let apartadosOrdenados   = [];
let indiceApartadoActual = 0;

let contenidoDiapositivas   = {};
let listaSubapartadosGlobal = [];
let indiceSubapartadoActual = 0;
let tipoDiapositivaActual   = "resumen";

let vozSeleccionada = "Kore";

// Estado de controles de imagen
let imgConfig = { fit:'cover', w:35, h:55, r:8, pos:'top' };

const estilosFondos = {
    "azul-sereno":    "linear-gradient(135deg,#dbeafe 0%,#eff6ff 100%)",
    "verde-bosque":   "linear-gradient(135deg,#dcfce7 0%,#f0fdf4 100%)",
    "rosa-suave":     "linear-gradient(135deg,#fce7f3 0%,#fdf2f8 100%)",
    "ambar-calido":   "linear-gradient(135deg,#fef3c7 0%,#fffbeb 100%)",
    "violeta-niebla": "linear-gradient(135deg,#ede9fe 0%,#f5f3ff 100%)",
    "teal-oceano":    "linear-gradient(135deg,#ccfbf1 0%,#f0fdfa 100%)",
    "naranja-atardecer":"linear-gradient(135deg,#ffedd5 0%,#fff7ed 100%)",
    "gris-perla":     "linear-gradient(135deg,#f1f5f9 0%,#f8fafc 100%)"
};
const ESTILOS_LISTA = Object.keys(estilosFondos);
// Trama SVG asociada a cada fondo -- da personalidad visual única
const ESTILOS_TRAMA = {
    "azul-sereno":       "dots",
    "verde-bosque":      "lines",
    "rosa-suave":        "waves",
    "ambar-calido":      "grid",
    "violeta-niebla":    "hex",
    "teal-oceano":       "zigzag",
    "naranja-atardecer": "cross",
    "gris-perla":        "none"
};
const coloresHexPPTX = {
    "azul-sereno":"dbeafe","verde-bosque":"dcfce7","rosa-suave":"fce7f3",
    "ambar-calido":"fef3c7","violeta-niebla":"ede9fe","teal-oceano":"ccfbf1",
    "naranja-atardecer":"ffedd5","gris-perla":"f1f5f9"
};
// Asigna fondo diferente a cada subapartado de forma automática
function estiloParaIndice(i) { return ESTILOS_LISTA[i % ESTILOS_LISTA.length]; }

// =========================================================================
//  INIT
// =========================================================================
// Ejecutar init cuando el DOM esté listo -- compatible con defer y file://
function initApp() {
    registrarServiceWorker();
    configurarInstalacionPWA();
    verificarSesionGuardada();

    // Toggle sección avatar según modo vídeo
    document.addEventListener('change', function(e) {
        if (e.target.name === 'video-modo') {
            const sec = document.getElementById('avatar-upload-section');
            if (sec) sec.style.display = e.target.value === 'avatar' ? 'block' : 'none';
        }
    });
}

// Doble seguro: DOMContentLoaded + window.onload como fallback
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // DOM ya cargado (scripts sin defer, o cargado tarde)
    initApp();
}

function registrarServiceWorker() {
    // Solo registrar SW en http/https, no en file:// (doble clic)
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register('./sw.js')
            .then(r => console.log('SW:',r.scope)).catch(()=>{});
    }
}

// =========================================================================
//  PWA
// =========================================================================
let deferredPrompt = null;
function configurarInstalacionPWA() {
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault(); deferredPrompt = e;
        const b = document.getElementById('btn-instalar-pwa');
        if (b) b.style.display = 'inline-flex';
    });
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        const b = document.getElementById('btn-instalar-pwa');
        if (b) b.style.display = 'none';
        mostrarToast('✅ ¡AprendIA instalada!');
    });
}
async function instalarPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') mostrarToast('🎉 Instalación iniciada!');
}

// =========================================================================
//  TOAST
// =========================================================================
function mostrarToast(msg, tipo='success') {
    const t = document.getElementById('toast-notification');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast toast-${tipo} show`;
    setTimeout(() => t.classList.remove('show'), 3500);
}

// =========================================================================
//  SESIÓN
// =========================================================================
function verificarSesionGuardada() {
    const s = localStorage.getItem("aprendia_session");
    if (!s) return;
    try {
        const d = JSON.parse(s);
        if (!d.email || !(d.keys?.openrouter || d.keys?.gemini)) return;
        usuarioActivo = d.email;
        apiKeys = { ...apiKeys, ...d.keys };
        // Alias
        if (!apiKeys.openrouter && apiKeys.gemini) apiKeys.openrouter = apiKeys.gemini;
        if (!apiKeys.gemini && apiKeys.openrouter) apiKeys.gemini = apiKeys.openrouter;
        arrancarInterfazLogueada(); // Entra directamente sin pedir login
    } catch(_) { localStorage.removeItem("aprendia_session"); }
}
function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    const emailEl = document.getElementById('login-email');
    const passEl  = document.getElementById('login-password');
    const keyEl   = document.getElementById('login-key');
    if (!emailEl || !passEl || !keyEl) {
        console.error('[Login] Elementos del formulario no encontrados');
        mostrarToast('Error interno. Recarga la página.','error');
        return;
    }
    const email = emailEl.value.trim();
    const pass  = passEl.value.trim();
    const gkey  = keyEl.value.trim();
    console.log('[Login] Intentando con email:', email, '| key:', gkey ? 'presente' : 'vacía');
    if (!email || !pass || !gkey) { mostrarToast('Completa todos los campos.','error'); return; }

    usuarioActivo       = email;
    apiKeys.openrouter  = gkey;
    apiKeys.gemini      = gkey; // alias para compatibilidad interna

    // Conservar otras keys guardadas (unsplash, pexels, drive)
    const ex = localStorage.getItem("aprendia_session");
    if (ex) try {
        const d = JSON.parse(ex);
        apiKeys = { ...d.keys, openrouter: gkey, gemini: gkey };
    } catch(_) {}

    guardarSesion();
    mostrarToast('✅ Sesión iniciada correctamente.');
    arrancarInterfazLogueada();
}
function guardarSesion() {
    localStorage.setItem("aprendia_session", JSON.stringify({
        email: usuarioActivo,
        keys:  apiKeys,
        ts:    Date.now()
    }));
}
function arrancarInterfazLogueada() {
    console.log('[App] Arrancando interfaz para:', usuarioActivo);
    const emailEl = document.getElementById('txt-user-email');
    if (emailEl) emailEl.innerText = usuarioActivo;
    const navbar = document.getElementById('global-navbar');
    if (navbar) {
        navbar.style.display = 'flex';
    } else {
        console.error('[App] Navbar no encontrado en DOM');
    }
    try { actualizarIndicadoresAPIs(); } catch(e) { console.warn('APIs dots:', e); }
    try { revisarTokenOAuthEnURL(); } catch(e) {}
    mostrarPantallaCarpetas();
}
function ejecutarCierreSesion() {
    localStorage.removeItem("aprendia_session");
    usuarioActivo = null;
    apiKeys = { gemini:"", openrouter:"", unsplash:"", pexels:"", drive:"" };
    document.getElementById('global-navbar').style.display = 'none';
    cambiarPantalla('screen-login');
}

// =========================================================================
//  APIs PANTALLA
// =========================================================================
function mostrarPantallaAPIs() {
    document.getElementById('api-unsplash').value = apiKeys.unsplash || '';
    document.getElementById('api-pexels').value   = apiKeys.pexels   || '';
    document.getElementById('api-drive').value    = apiKeys.drive    || '';
    cambiarPantalla('screen-apis');
}
function handleGuardarAPIs(e) {
    e.preventDefault();
    apiKeys = {
        gemini:    apiKeys.gemini,     // conservar la key de OpenRouter del login
        openrouter:apiKeys.openrouter,
        unsplash:  document.getElementById('api-unsplash').value.trim(),
        pexels:    document.getElementById('api-pexels').value.trim(),
        drive:     document.getElementById('api-drive').value.trim()
    };
    guardarSesion();
    actualizarIndicadoresAPIs();
    mostrarToast('✅ APIs guardadas correctamente.');
    mostrarPantallaCarpetas();
}
function actualizarIndicadoresAPIs() {
    const orKey = apiKeys.openrouter || apiKeys.gemini;
    [['dot-gemini',orKey],['dot-unsplash',apiKeys.unsplash],
     ['dot-pexels',apiKeys.pexels],['dot-drive',apiKeys.drive]].forEach(([id,key]) => {
        const el = document.getElementById(id); if (!el) return;
        el.className = 'api-dot' + (key ? ' on' : '');
    });
    // tarjetas estado en pantalla APIs
    [['status-unsplash',apiKeys.unsplash],
     ['status-pexels',apiKeys.pexels],['status-drive',apiKeys.drive]].forEach(([id,key]) => {
        const el = document.getElementById(id); if (!el) return;
        el.textContent = key ? 'Activa' : 'Inactiva';
        el.className = 'api-status ' + (key ? 'on' : 'off');
    });
}

// =========================================================================
//  ENRUTADOR
// =========================================================================
function cambiarPantalla(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const loadEl = document.getElementById('screen-loading');
    if (loadEl) loadEl.style.display = 'none';
    const panel = document.getElementById('main-panel');
    if (panel) panel.classList.toggle('wide', id==='screen-diapositivas');
    const t = document.getElementById(id);
    if (t) t.classList.add('active');
}
function mostrarCargando(txt) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const loadEl = document.getElementById('screen-loading');
    if (loadEl) {
        loadEl.style.display = 'block';
        loadEl.classList.add('active');
    }
    const loadTxt = document.getElementById('loading-text');
    if (loadTxt) loadTxt.innerText = txt;
}

// =========================================================================
//  UPLOAD DE DOCUMENTOS
// =========================================================================
const MAX_DOCS = 5;

function handleDragOver(e)  { e.preventDefault(); document.getElementById('upload-zone').classList.add('drag-over'); }
function handleDragLeave()  { document.getElementById('upload-zone').classList.remove('drag-over'); }
function handleDrop(e)      { e.preventDefault(); handleDragLeave(); agregarArchivos(e.dataTransfer.files); }

async function agregarArchivos(files) {
    for (const file of Array.from(files)) {
        if (documentosReferencia.length >= MAX_DOCS) { mostrarToast(`Máximo ${MAX_DOCS} archivos.`,'error'); break; }
        if (documentosReferencia.find(d => d.nombre === file.name)) continue;
        const doc = await leerArchivo(file);
        documentosReferencia.push(doc);
    }
    renderizarListaArchivos();
}

function leerArchivo(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        const esPDF = file.type === 'application/pdf';
        const esBin = esPDF || file.name.endsWith('.docx') || file.name.endsWith('.pptx');

        reader.onload = e => {
            const result = e.target.result;
            if (esBin) {
                // Guardamos base64 para enviar a Gemini como inline_data
                const b64 = result.split(',')[1];
                resolve({ nombre:file.name, tipo:file.type||'application/octet-stream', base64:b64, texto:null, tamano:file.size });
            } else {
                resolve({ nombre:file.name, tipo:'text/plain', base64:null, texto:result, tamano:file.size });
            }
        };
        if (esBin) reader.readAsDataURL(file);
        else        reader.readAsText(file, 'UTF-8');
    });
}

function eliminarArchivo(nombre) {
    documentosReferencia = documentosReferencia.filter(d => d.nombre !== nombre);
    renderizarListaArchivos();
}

function renderizarListaArchivos() {
    const lista = document.getElementById('files-list-upload');
    const label = document.getElementById('upload-count-label');
    lista.innerHTML = '';
    documentosReferencia.forEach(doc => {
        const icons = { pdf:'📄', txt:'📝', docx:'📘', doc:'📘', pptx:'📊', md:'🗒', csv:'📋' };
        const ext   = doc.nombre.split('.').pop().toLowerCase();
        const icon  = icons[ext] || '📎';
        const kb    = (doc.tamano / 1024).toFixed(0);
        const div   = document.createElement('div');
        div.className = 'file-chip';
        div.innerHTML = `<span class="file-chip-icon">${icon}</span>
            <span class="file-chip-name" title="${doc.nombre}">${doc.nombre}</span>
            <span class="file-chip-size">${kb} KB</span>
            <button type="button" class="file-chip-del" onclick="eliminarArchivo('${doc.nombre}')">✕</button>`;
        lista.appendChild(div);
    });
    label.textContent = `${documentosReferencia.length} archivo${documentosReferencia.length !== 1 ? 's' : ''}`;
}

// Construye la parte de documentos para el prompt de Gemini
function buildDocsContext() {
    if (!documentosReferencia.length) return "";
    const partes = documentosReferencia
        .filter(d => d.texto)
        .map(d => `--- DOCUMENTO: ${d.nombre} ---\n${d.texto.substring(0, 4000)}\n---`);
    return partes.length
        ? `\n\nDOCUMENTOS DE REFERENCIA APORTADOS POR EL DOCENTE (úsalos para enriquecer el contenido):\n${partes.join('\n\n')}`
        : "";
}

// Construye array de partes inline para PDFs/binarios en Gemini API
function buildDocsParts() {
    return documentosReferencia
        .filter(d => d.base64)
        .map(d => ({ inline_data: { mime_type: d.tipo, data: d.base64 } }));
}

// =========================================================================
//  GEMINI API
// =========================================================================
async function llamarGemini(prompt, usarDocs = false) {
    if (!apiKeys.gemini) throw new Error("Falta la API Key de OpenRouter. Ve a ⚙️ APIs.");

    const textoFinal = prompt + (usarDocs ? buildDocsContext() : "");

    // openrouter/auto selecciona automáticamente el mejor modelo gratuito disponible
    let r;
    try {
        // Detectar URL real para el Referer (funciona tanto en local como en GitHub Pages)
        const siteUrl = location.origin || 'https://aprendia.app';
        r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKeys.gemini}`,
                'HTTP-Referer': siteUrl,
                'X-Title': 'AprendIA',
                'Origin': siteUrl
            },
            body: JSON.stringify({
                model: 'openrouter/auto',
                messages: [
                    {
                        role: 'system',
                        content: 'Eres experto en diseño curricular y educación. Responde SIEMPRE con JSON válido y nada más. Sin explicaciones, sin markdown, sin bloques de código. Solo el JSON puro.'
                    },
                    {
                        role: 'user',
                        content: textoFinal
                    }
                ],
                temperature: 0.5,
                max_tokens: 4096
            })
        });
    } catch (netErr) {
        throw new Error("Error de red. Comprueba tu conexión a internet.");
    }

    if (!r.ok) {
        let errMsg = `Error HTTP ${r.status}`;
        try { const e = await r.json(); errMsg = e.error?.message || e.error || errMsg; } catch(_) {}
        if (r.status === 401) throw new Error("API Key de OpenRouter inválida. Verifica la key en ⚙️ APIs.");
        if (r.status === 429) throw new Error("Límite de OpenRouter alcanzado. Espera un momento e inténtalo.");
        if (r.status === 402) throw new Error("Sin créditos en OpenRouter. Revisa tu cuenta.");
        throw new Error(errMsg);
    }

    const data = await r.json();
    console.log("[OpenRouter] Respuesta:", JSON.stringify(data).substring(0, 300));

    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) throw new Error("OpenRouter no devolvió respuesta. Inténtalo de nuevo.");

    console.log("[OpenRouter] Texto:", rawText.substring(0, 200));

    // Extracción robusta de JSON
    let txt = rawText.trim();
    txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    const iArr = txt.indexOf('[');
    const iObj = txt.indexOf('{');
    let iStart = -1;
    if (iArr !== -1 && iObj !== -1) iStart = Math.min(iArr, iObj);
    else if (iArr !== -1) iStart = iArr;
    else if (iObj !== -1) iStart = iObj;

    const iEnd = Math.max(txt.lastIndexOf(']'), txt.lastIndexOf('}'));
    if (iStart !== -1 && iEnd !== -1 && iEnd > iStart) {
        txt = txt.substring(iStart, iEnd + 1);
    }

    try {
        return JSON.parse(txt);
    } catch (parseErr) {
        console.error("[OpenRouter] Error parseando JSON:", txt.substring(0, 300));
        throw new Error("La IA devolvió un formato inesperado. Inténtalo de nuevo.");
    }
}


// =========================================================================
//  TEST RÁPIDO DE API KEY
// =========================================================================
async function testearAPIKey(key) {
    try {
        const siteUrl2 = location.origin || 'https://aprendia.app';
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
                'HTTP-Referer': siteUrl2,
                'X-Title': 'AprendIA',
                'Origin': siteUrl2
            },
            body: JSON.stringify({
                model: 'openrouter/auto',
                messages: [{ role: 'user', content: 'Di: {"ok":true}' }],
                max_tokens: 20
            })
        });
        if (r.status === 401) return { ok: false, msg: "API Key de OpenRouter inválida." };
        if (r.status === 402) return { ok: false, msg: "Sin créditos en OpenRouter." };
        if (!r.ok && r.status !== 429) return { ok: false, msg: `Error ${r.status}` };
        return { ok: true, msg: "Conexión con OpenRouter verificada ✓" };
    } catch(_) {
        return { ok: false, msg: "Error de red. Comprueba tu conexión." };
    }
}

// Gemini TTS (Multimodal Live API vía REST simulada con speech synthesis)
// Gemini 2.0 Flash no expone TTS REST directo en el free tier todavía,
// por lo que usamos Web Speech API (SpeechSynthesis) del navegador -- funciona offline,
// sin coste y sin API key adicional. Genera audio por diapositiva.
async function generarAudioDiapositiva(texto, voz) {
    return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) { resolve(null); return; }
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang  = 'es-ES';
        utterance.rate  = 0.92;
        utterance.pitch = 1;
        // Intentar asignar la voz seleccionada si el navegador la tiene
        const voices = speechSynthesis.getVoices();
        const match  = voices.find(v => v.lang.startsWith('es') && v.name.toLowerCase().includes(voz.toLowerCase()));
        if (match) utterance.voice = match;
        resolve(utterance); // Devolvemos utterance para reproducir en secuencia
    });
}

// =========================================================================
//  UNSPLASH / PEXELS / FALLBACK
// =========================================================================
// =========================================================================
//  CONTROLES DE IMAGEN -- subir, ajustar, encajar
// =========================================================================

function subirImagenPropia(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const url = e.target.result;
        const sub = listaSubapartadosGlobal[indiceSubapartadoActual]?.subapartado;
        if (!sub) return;
        // Añadir al inicio de la galería
        if (!contenidoDiapositivas[sub].imagenesDisponibles)
            contenidoDiapositivas[sub].imagenesDisponibles = [];
        contenidoDiapositivas[sub].imagenesDisponibles.unshift(url);
        contenidoDiapositivas[sub][tipoDiapositivaActual].img = url;
        renderizarDiapositivaActual();
        mostrarToast('✅ Imagen propia añadida y seleccionada.');
    };
    reader.readAsDataURL(file);
    // Limpiar input para permitir subir la misma imagen otra vez
    input.value = '';
}

function mostrarControlesImagen(visible) {
    const panel = document.getElementById('img-controls-panel');
    if (!panel) return;
    panel.classList.toggle('open', visible);
    if (visible) sincronizarControlesImagen();
}

function sincronizarControlesImagen() {
    document.getElementById('range-img-w').value = imgConfig.w;
    document.getElementById('range-img-h').value = imgConfig.h;
    document.getElementById('range-img-r').value = imgConfig.r;
    document.getElementById('val-img-w').textContent = imgConfig.w;
    document.getElementById('val-img-h').textContent = imgConfig.h;
    document.getElementById('val-img-r').textContent = imgConfig.r;
    // Botones fit
    ['cover','contain','fill'].forEach(f => {
        document.getElementById('fit-'+f)?.classList.toggle('on', imgConfig.fit===f);
    });
    // Botones pos
    ['top','center','bottom'].forEach(p => {
        document.getElementById('pos-'+p)?.classList.toggle('on', imgConfig.pos===p);
    });
    aplicarEstiloImagen();
}

function cambiarFitImagen(fit) {
    imgConfig.fit = fit;
    ['cover','contain','fill'].forEach(f =>
        document.getElementById('fit-'+f)?.classList.toggle('on', f===fit));
    aplicarEstiloImagen();
}

function cambiarPosImagen(pos) {
    imgConfig.pos = pos;
    ['top','center','bottom'].forEach(p =>
        document.getElementById('pos-'+p)?.classList.toggle('on', p===pos));
    aplicarEstiloImagen();
}

function ajustarImagen() {
    imgConfig.w = parseInt(document.getElementById('range-img-w').value);
    imgConfig.h = parseInt(document.getElementById('range-img-h').value);
    imgConfig.r = parseInt(document.getElementById('range-img-r').value);
    document.getElementById('val-img-w').textContent = imgConfig.w;
    document.getElementById('val-img-h').textContent = imgConfig.h;
    document.getElementById('val-img-r').textContent = imgConfig.r;
    aplicarEstiloImagen();
}

function aplicarEstiloImagen() {
    const wrapper = document.getElementById('slide-img-wrapper');
    const img     = document.getElementById('slide-img-src');
    if (!wrapper || !img) return;
    wrapper.style.width        = imgConfig.w + '%';
    wrapper.style.height       = imgConfig.h + '%';
    wrapper.style.minHeight    = '80px';
    wrapper.style.borderRadius = imgConfig.r + 'px';
    img.style.objectFit        = imgConfig.fit;
    img.style.objectPosition   = 'center ' + imgConfig.pos;
    // Guardar en datos de la diapositiva actual
    const sub = listaSubapartadosGlobal[indiceSubapartadoActual]?.subapartado;
    if (sub && contenidoDiapositivas[sub]) {
        contenidoDiapositivas[sub][tipoDiapositivaActual].imgConfig = Object.assign({}, imgConfig);
    }
}

async function buscarImagenes(keywords, cantidad=5) {
    const q = encodeURIComponent(keywords);
    if (apiKeys.unsplash) {
        try {
            const r = await fetch(`https://api.unsplash.com/search/photos?query=${q}&per_page=${cantidad}&orientation=landscape`,
                { headers:{ Authorization:`Client-ID ${apiKeys.unsplash}` } });
            if (r.ok) {
                const data = await r.json();
                const imgs = data.results?.map(p => p.urls?.regular).filter(Boolean);
                if (imgs?.length) return imgs;
            }
        } catch(_) {}
    }
    if (apiKeys.pexels) {
        try {
            const r = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=${cantidad}&orientation=landscape`,
                { headers:{ Authorization:apiKeys.pexels } });
            if (r.ok) {
                const data = await r.json();
                const imgs = data.photos?.map(p => p.src?.large).filter(Boolean);
                if (imgs?.length) return imgs;
            }
        } catch(_) {}
    }
    // Fallback: Wikimedia Commons API -- imágenes reales relacionadas con el tema
    try {
        const wiki = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&prop=pageimages&piprop=original&pilimit=${cantidad}&format=json&origin=*`
        );
        if (wiki.ok) {
            const data = await wiki.json();
            const pages = Object.values(data.query?.pages || {});
            const imgs  = pages.map(p => p.original?.source).filter(u => u && /\.(jpg|jpeg|png|webp)/i.test(u));
            if (imgs.length >= 2) return imgs.slice(0, cantidad);
        }
    } catch(_) {}
    // Último fallback: picsum con seed del keyword
    return Array.from({length: cantidad}, (_,i) =>
        `https://picsum.photos/seed/${encodeURIComponent(keywords).substring(0,20)}-${i+1}/800/450`
    );
}

// =========================================================================
//  GOOGLE DRIVE
// =========================================================================
function revisarTokenOAuthEnURL() {
    const hash = location.hash;
    if (!hash.includes('access_token=')) return;
    const params = new URLSearchParams(hash.substring(1));
    const token  = params.get('access_token');
    if (!token) return;
    sessionStorage.setItem('drive_access_token', token);
    history.replaceState(null,'',location.pathname);
    mostrarToast('✅ Google Drive autorizado.');
}

async function subirAGoogleDrive(blob, nombre, mimeType) {
    if (!apiKeys.drive) { mostrarToast('Configura el Client ID de Drive en ⚙️ APIs.','error'); return; }
    const token = sessionStorage.getItem('drive_access_token');
    if (!token) {
        const scope      = 'https://www.googleapis.com/auth/drive.file';
        const redirectUri = location.origin + location.pathname;
        location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${apiKeys.drive}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}`;
        return;
    }
    mostrarToast('⬆️ Subiendo a Google Drive...');
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name:nombre, mimeType })], { type:'application/json' }));
    form.append('file', blob);
    const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:form });
    if (r.ok) mostrarToast(`✅ "${nombre}" guardado en Drive.`);
    else { sessionStorage.removeItem('drive_access_token'); mostrarToast('Token caducado. Vuelve a intentarlo.','error'); }
}

// =========================================================================
//  CARPETAS
// =========================================================================
function obtenerCarpetasLocales() {
    const c = localStorage.getItem(`aprendia_temas_${usuarioActivo}`);
    return c ? JSON.parse(c) : {};
}
const NIVEL_LABELS = {
    primaria:      { label:'Primaria',                  emoji:'🌱', color:'#22c55e' },
    eso:           { label:'ESO',                       emoji:'📗', color:'#3b82f6' },
    bachillerato:  { label:'Bachillerato',              emoji:'📘', color:'#6366f1' },
    fp:            { label:'Formación Profesional',     emoji:'🔧', color:'#f59e0b' },
    universitario: { label:'Universitario',             emoji:'🎓', color:'#a855f7' }
};

function mostrarPantallaCarpetas() {
    cambiarPantalla('screen-carpetas');
    document.getElementById('box-files-viewer').style.display = 'none';
    const grid = document.getElementById('box-folders-grid');
    grid.innerHTML = '';
    const carpetas = obtenerCarpetasLocales();
    const llaves   = Object.keys(carpetas);

    if (!llaves.length) {
        grid.innerHTML = `<p class="empty-state">Sin unidades didácticas aún.<br>Pulsa <strong>Nuevo Tema</strong> para crear la primera.</p>`;
        return;
    }

    // Agrupar por nivel
    const porNivel = {};
    llaves.forEach(tema => {
        const info  = carpetas[tema];
        const nivel = info.datosCurriculares?.nivel || 'otros';
        if (!porNivel[nivel]) porNivel[nivel] = [];
        porNivel[nivel].push(tema);
    });

    // Orden de niveles
    const ordenNiveles = ['primaria','eso','bachillerato','fp','universitario','otros'];
    const nivelesPresentes = ordenNiveles.filter(n => porNivel[n]);

    nivelesPresentes.forEach(nivel => {
        const meta = NIVEL_LABELS[nivel] || { label: nivel, emoji:'📁', color:'#64748b' };

        // Cabecera de nivel
        const header = document.createElement('div');
        header.className = 'nivel-section';
        header.innerHTML = `
            <div class="nivel-header">
                <span class="nivel-dot" style="background:${meta.color}"></span>
                <span class="nivel-emoji">${meta.emoji}</span>
                <span class="nivel-name">${meta.label}</span>
                <span class="nivel-badge">${porNivel[nivel].length} tema${porNivel[nivel].length !== 1 ? 's' : ''}</span>
            </div>`;
        grid.appendChild(header);

        // Grid de temas de este nivel
        const subgrid = document.createElement('div');
        subgrid.className = 'folders-grid';

        porNivel[nivel].forEach(tema => {
            const info  = carpetas[tema];
            const fecha = info.fechaGuardado ? new Date(info.fechaGuardado).toLocaleDateString('es-ES') : '';
            const pills = info.listaSubapartadosGlobal?.length || 0;
            const card  = document.createElement('div');
            card.className = 'folder-card';
            card.style.setProperty('--nivel-color', meta.color);
            card.innerHTML = `
                <div class="folder-card-accent" style="background:${meta.color}"></div>
                <span class="folder-icon">📁</span>
                <div class="folder-name">${tema}</div>
                <div class="folder-meta">${pills} Píldoras · ${fecha}</div>
                <button class="folder-del" onclick="eliminarCarpeta(event,'${tema}')" title="Eliminar">✕</button>`;
            card.onclick = () => verArchivosDeCarpeta(tema);
            subgrid.appendChild(card);
        });

        grid.appendChild(subgrid);
    });
}
function eliminarCarpeta(e, tema) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${tema}"?`)) return;
    const c = obtenerCarpetasLocales(); delete c[tema];
    localStorage.setItem(`aprendia_temas_${usuarioActivo}`, JSON.stringify(c));
    mostrarPantallaCarpetas();
    mostrarToast(`Carpeta "${tema}" eliminada.`);
}
function verArchivosDeCarpeta(tema) {
    document.getElementById('box-files-viewer').style.display = 'block';
    document.getElementById('txt-carpeta-seleccionada').innerText = `Contenidos: ${tema}`;
    const cont = document.getElementById('lista-archivos-contenedor');
    cont.innerHTML = '';
    const filas = [
        { i:'📊', n:`Presentacion_${tema}.pptx`, c:'#4f46e5', l:'Descargar PPTX', fn:`descargarPPTXDesdeCarpeta('${tema}')` },
        { i:'📝', n:`Evaluacion_${tema}.doc`,    c:'#2563eb', l:'Descargar Word', fn:`descargarExamenDesdeCarpeta('${tema}')` },
        { i:'📖', n:'Guion Completo del Profesor',c:'#6d28d9', l:'Ver Guion',     fn:`verGuionDesdeCarpeta('${tema}')` },
        { i:'🎬', n:'Vídeo Narrado',              c:'#b45309', l:'Generar',        fn:`abrirVideoDesdeCarpeeta('${tema}')` },
        { i:'☁️', n:'Google Drive',              c:'#16a34a', l:'Subir PPTX',     fn:`subirPPTXADrive('${tema}')` },
        { i:'⚙️', n:'Panel de Edición',           c:'#059669', l:'Abrir',          fn:`cargarWorkspaceDesdeCarpeta('${tema}')` },
    ];
    filas.forEach(f => {
        const d = document.createElement('div'); d.className = 'file-row';
        d.innerHTML = `<div class="file-info"><span>${f.i}</span> <strong>${f.n}</strong></div>
            <button class="btn-download-file" style="background:${f.c}" onclick="${f.fn}">${f.l}</button>`;
        cont.appendChild(d);
    });
}
function cargarDatosCarpeta(tema) {
    const c = obtenerCarpetasLocales()[tema];
    datosCurriculares        = c.datosCurriculares;
    listaSubapartadosGlobal  = c.listaSubapartadosGlobal;
    contenidoDiapositivas    = c.contenidoDiapositivas;
}
function cargarWorkspaceDesdeCarpeta(tema) {
    cargarDatosCarpeta(tema);
    indiceSubapartadoActual = 0; tipoDiapositivaActual = "resumen";
    renderizarDiapositivaActual(); cambiarPantalla('screen-diapositivas');
}
function descargarPPTXDesdeCarpeta(tema) { cargarDatosCarpeta(tema); exportarClaseAPowerPoint(); }
function descargarExamenDesdeCarpeta(tema) { cargarDatosCarpeta(tema); exportarExamenWord(); }
function verGuionDesdeCarpeta(tema) { cargarDatosCarpeta(tema); abrirModalGuion(); }
function abrirVideoDesdeCarpeeta(tema) { cargarDatosCarpeta(tema); abrirModalVideo(); }
async function subirPPTXADrive(tema) {
    cargarDatosCarpeta(tema);
    const blob   = await construirPPTX().write({ outputType:'blob' });
    const nombre = `Presentacion_AprendIA_${tema.replace(/\s+/g,'_')}.pptx`;
    await subirAGoogleDrive(blob, nombre, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
}

// =========================================================================
//  FASE 1 -- CONFIGURACIÓN
// =========================================================================
async function handleConfig(e) {
    e.preventDefault();
    datosCurriculares = {
        tema:     document.getElementById('cfg-tema').value.trim(),
        nivel:    document.getElementById('cfg-nivel').value,
        duracion: document.getElementById('cfg-duracion').value,
        estilo:   document.getElementById('cfg-estilo').value
    };
    mostrarCargando(`Planificando estructura para: ${datosCurriculares.tema}...`);
    const docsCtx = buildDocsContext();
    const prompt  = `Actúa como planificador curricular. Diseña los bloques de contenido para una sesión de nivel "${datosCurriculares.nivel}" sobre "${datosCurriculares.tema}". Duración: "${datosCurriculares.duracion}".
Regla de bloques: 30min-1h → máx 3 | 2h → 4-5 | 3-5h → 6-8.
${docsCtx ? 'Usa los documentos adjuntos como referencia de contenido.' : ''}
Devuelve SOLO un array JSON de strings. Ejemplo: ["Introducción","Desarrollo","Cierre"]`;
    try {
        const res = await llamarGemini(prompt, documentosReferencia.length > 0);
        if (!Array.isArray(res)) throw new Error("Formato inesperado");
        listaApartados = res;
        renderizarApartados();
        cambiarPantalla('screen-apartados');
    } catch(err) {
        console.error('[handleConfig]', err);
        cambiarPantalla('screen-config');
        mostrarToast('❌ ' + err.message, 'error');
    }
}

// =========================================================================
//  APARTADOS
// =========================================================================
function renderizarApartados() {
    const c = document.getElementById('lista-apartados'); c.innerHTML='';
    listaApartados.forEach((ap,i) => {
        const d = document.createElement('div'); d.className='drag-item';
        d.innerHTML=`<span class="drag-handle">☰</span><input type="text" class="drag-input" value="${ap}">
            <button type="button" class="drag-del" onclick="eliminarApartado(${i})">✕</button>`;
        c.appendChild(d);
    });
    Sortable.create(c, { handle:'.drag-handle', animation:150 });
}
function agregarApartado() {
    const v=document.getElementById('new-apartado-text').value.trim();
    if(v){ listaApartados.push(v); renderizarApartados(); document.getElementById('new-apartado-text').value=''; }
}
function eliminarApartado(i) { listaApartados.splice(i,1); renderizarApartados(); }
async function guardarApartadosSiguiente() {
    const ins = document.querySelectorAll('#lista-apartados .drag-input');
    listaApartados = Array.from(ins).map(x=>x.value.trim()).filter(Boolean);
    if (!listaApartados.length) { mostrarToast('Añade al menos un bloque.','error'); return; }
    estructuraCompleta={}; apartadosOrdenados=[...listaApartados]; indiceApartadoActual=0;
    await cargarSubapartados();
}

// =========================================================================
//  SUBAPARTADOS
// =========================================================================
async function cargarSubapartados() {
    const padre = apartadosOrdenados[indiceApartadoActual];
    mostrarCargando(`Desglosando subtemas de: "${padre}"...`);
    const prompt=`Para nivel "${datosCurriculares.nivel}" y duración "${datosCurriculares.duracion}", extrae los subconceptos clave del bloque "${padre}" (tema: "${datosCurriculares.tema}").
Devuelve SOLO un array JSON de strings, máximo 5.`;
    try {
        const res=await llamarGemini(prompt, documentosReferencia.length>0);
        estructuraCompleta[padre]=Array.isArray(res)?res:["Marco Teórico"];
        renderizarSubapartados();
    } catch(err){ mostrarToast('⚠️ '+err.message,'error'); cambiarPantalla('screen-apartados'); }
}
function renderizarSubapartados() {
    cambiarPantalla('screen-subapartados');
    const padre=apartadosOrdenados[indiceApartadoActual];
    document.getElementById('badge-apartado-actual').innerText=`Módulo ${indiceApartadoActual+1} de ${apartadosOrdenados.length}`;
    document.getElementById('title-apartado-padre').innerText=padre;
    const c=document.getElementById('lista-subapartados'); c.innerHTML='';
    (estructuraCompleta[padre]||[]).forEach((sub,i)=>{
        const d=document.createElement('div'); d.className='drag-item sub';
        d.innerHTML=`<span class="drag-handle">☰</span><input type="text" class="drag-input" value="${sub}">
            <button type="button" class="drag-del" onclick="eliminarSubapartado(${i})">✕</button>`;
        c.appendChild(d);
    });
    Sortable.create(c,{handle:'.drag-handle',animation:150});
    document.getElementById('btn-sub-siguiente').innerText=
        indiceApartadoActual===apartadosOrdenados.length-1?"Compilar Workspace →":"Siguiente Módulo →";
}
function agregarSubapartado() {
    const v=document.getElementById('new-subapartado-text').value.trim();
    if(v){ estructuraCompleta[apartadosOrdenados[indiceApartadoActual]].push(v); renderizarSubapartados(); document.getElementById('new-subapartado-text').value=''; }
}
function eliminarSubapartado(i){ estructuraCompleta[apartadosOrdenados[indiceApartadoActual]].splice(i,1); renderizarSubapartados(); }
async function navegarApartado(dir) {
    const ins=document.querySelectorAll('#lista-subapartados .drag-input');
    estructuraCompleta[apartadosOrdenados[indiceApartadoActual]]=Array.from(ins).map(x=>x.value.trim());
    indiceApartadoActual+=dir;
    if(indiceApartadoActual<0)                              cambiarPantalla('screen-apartados');
    else if(indiceApartadoActual<apartadosOrdenados.length) await cargarSubapartados();
    else                                                    await generarTodoElContenido();
}

// =========================================================================
//  GENERACIÓN DE CONTENIDO
// =========================================================================
async function generarTodoElContenido() {
    mostrarCargando("Compilando estructura...");
    listaSubapartadosGlobal=[];
    for(const padre of apartadosOrdenados)
        for(const sub of estructuraCompleta[padre])
            listaSubapartadosGlobal.push({padre,subapartado:sub});

    const LOTE=3; contenidoDiapositivas={};
    for(let i=0;i<listaSubapartadosGlobal.length;i+=LOTE){
        const lote=listaSubapartadosGlobal.slice(i,i+LOTE);
        mostrarCargando(`Generando material ${i+1}-${Math.min(i+LOTE,listaSubapartadosGlobal.length)} de ${listaSubapartadosGlobal.length}...`);
        const tieneReferencias = documentosReferencia.length>0;
        const prompt=`Tema: "${datosCurriculares.tema}" (${datosCurriculares.nivel}). Estilo: "${datosCurriculares.estilo}".
${tieneReferencias?'Usa los DOCUMENTOS DE REFERENCIA adjuntos para enriquecer el contenido.':''}
Genera material didactico COMPLETO y DETALLADO para estos subapartados: ${JSON.stringify(lote.map(x=>x.subapartado))}

REGLAS OBLIGATORIAS:
1. "keywords_imagen": 4 palabras en ingles MUY ESPECIFICAS del subapartado (no genericas). Si el subapartado es quimico, usa terminos quimicos. Si es historico, usa terminos historicos. Ejemplo: "electrochemical reduction cathode electrode" en vez de "education classroom"
2. Cada campo "texto" debe ser RICO Y COMPLETO: frase introductoria de 2-3 lineas + salto + minimo 5 viñetas con explicacion de 1-2 lineas cada una
3. Formato de texto: "Frase introductoria que contextualice el concepto en 2-3 lineas.\n\n• Punto 1: explicacion desarrollada de una o dos lineas\n• Punto 2: explicacion con ejemplo concreto\n• Punto 3: relacion con otros conceptos\n• Punto 4: aplicacion practica\n• Punto 5: dato clave o formula si aplica"

Por cada subapartado devuelve:
- "keywords_imagen": 4 palabras en ingles especificas del tema
- "resumen": { "texto": "[intro 2-3 lineas]\n\n• Concepto: explicacion\n• Base teorica: explicacion\n• Aplicacion: explicacion\n• Relacion: explicacion\n• Punto clave: explicacion", "script": "Guion docente detallado (5-7 frases explicando al alumno)", "estimacion_minutos": N }
- "ejemplo": { "texto": "[descripcion caso real 2-3 lineas]\n\n• Contexto: descripcion\n• Paso 1: descripcion\n• Paso 2: descripcion\n• Resultado: descripcion", "script": "Como explicar el ejemplo", "estimacion_minutos": N }
- "quiz": { "texto": "Pregunta evaluativa precisa?\nA) opcion\nB) opcion\nC) opcion\nD) opcion", "script": "Respuesta correcta: X. Justificacion completa." }

Devuelve SOLO array JSON con ${lote.length} objetos.`;

        let material=[];
        try{ material=await llamarGemini(prompt,tieneReferencias); if(!Array.isArray(material)) material=[material]; }
        catch(_){ material=lote.map(()=>null); }

        for(let j=0;j<lote.length;j++){
            const sub=lote[j].subapartado;
            const d=material[j]||{};
            // Usar keywords de IA + nombre del subapartado como fallback garantizado
            const kw=d.keywords_imagen||sub;
            mostrarCargando(`Buscando imágenes para "${sub}"...`);
            const imgs=await buscarImagenes(kw,5);
            const idxGlobal = listaSubapartadosGlobal.findIndex(x=>x.subapartado===sub);
            const estiloBase     = estiloParaIndice(idxGlobal * 3);
            const estiloEjemplo  = estiloParaIndice(idxGlobal * 3 + 1);
            const estiloQuiz     = estiloParaIndice(idxGlobal * 3 + 2);
            contenidoDiapositivas[sub]={
                imagenesDisponibles:imgs,
                resumen:{ texto:d.resumen?.texto||`Introducción a ${sub}.\n\n• Concepto principal: definición y alcance del término en el contexto de ${datosCurriculares.tema}\n• Fundamento teórico: bases conceptuales que sustentan este subapartado\n• Aplicación práctica: cómo se manifiesta en situaciones reales\n• Relación con otros conceptos: conexión con el resto de la unidad\n• Punto clave a recordar: síntesis del concepto más importante`, script:d.resumen?.script||"Guion pendiente.", estimacion_minutos:d.resumen?.estimacion_minutos||5, img:imgs[0], style:estiloBase },
                ejemplo:{ texto:d.ejemplo?.texto||`Caso práctico de ${sub}.\n\n• Contexto: descripción del escenario real\n• Desarrollo: pasos del proceso o aplicación\n• Resultado: qué se obtiene o concluye\n• Variante: otra forma de aplicarlo`, script:d.ejemplo?.script||"Explicación pendiente.", estimacion_minutos:d.ejemplo?.estimacion_minutos||5, img:imgs[1]||imgs[0], style:estiloEjemplo },
                quiz:   { texto:d.quiz?.texto||`¿Qué caracteriza a ${sub}?\nA) Opción A\nB) Opción B\nC) Opción C\nD) Opción D`, script:d.quiz?.script||"Respuesta pendiente.", estimacion_minutos:3, img:"", style:estiloQuiz }
            };
        }
    }
    indiceSubapartadoActual=0; tipoDiapositivaActual="resumen";
    guardarEnCarpeta(false);
    cambiarPantalla('screen-diapositivas');
    renderizarDiapositivaActual();
}

// =========================================================================
//  WORKSPACE
// =========================================================================
function renderizarDiapositivaActual() {
    const item=listaSubapartadosGlobal[indiceSubapartadoActual]; if(!item)return;
    const sub=item.subapartado; const bloque=contenidoDiapositivas[sub]; if(!bloque)return;
    const diapo=bloque[tipoDiapositivaActual];
    ['resumen','ejemplo','quiz'].forEach(t=>document.getElementById(`tab-${t}`).classList.toggle('active',tipoDiapositivaActual===t));
    const esQuiz=tipoDiapositivaActual==='quiz';
    document.getElementById('slide-img-wrapper').style.display      = esQuiz?'none':'flex';
    document.getElementById('box-style-slide-selector').style.display=esQuiz?'none':'block';
    // Fondo + trama
    const estiloKey = diapo.style || 'azul-sereno';
    const slideEl   = document.getElementById('slide-render');
    slideEl.style.background = estilosFondos[estiloKey] || Object.values(estilosFondos)[0];
    slideEl.setAttribute('data-pattern', ESTILOS_TRAMA[estiloKey] || 'dots');

    document.getElementById('slide-info-meta').innerText     = `${item.padre} · ${indiceSubapartadoActual+1}/${listaSubapartadosGlobal.length}`;
    document.getElementById('slide-title-content').innerText = sub;

    // Separar intro + puntos del texto detallado
    const partes   = diapo.texto.split('\n\n');
    const intro    = partes[0] || '';
    const puntos   = partes.slice(1).join('\n').split('\n').filter(l => l.startsWith('•'));
    const detalle  = partes.slice(1).join('\n').split('\n').filter(l => !l.startsWith('•') && l.trim()).join('\n');

    // Zona superior: intro + viñetas
    const puntosEl = document.getElementById('slide-text-content');
    if (puntosEl) puntosEl.innerText = intro + (puntos.length ? '\n\n' + puntos.join('\n') : '');

    // Zona inferior: texto detallado restante
    const detalleEl = document.getElementById('slide-text-detail');
    if (detalleEl) {
        detalleEl.innerText  = detalle;
        detalleEl.style.display = detalle ? 'block' : 'none';
    }

    if(diapo.img && !esQuiz) document.getElementById('slide-img-src').src=diapo.img;
    document.getElementById('edit-slide-text').value    = diapo.texto;
    document.getElementById('edit-slide-script').value  = diapo.script;
    document.getElementById('edit-slide-style').value   = estiloKey;
    document.getElementById('slide-time-badge').innerText = `⏱ ${diapo.estimacion_minutos||5} min`;
    renderizarGaleria(bloque.imagenesDisponibles, diapo.img);

    // Restaurar config de imagen guardada o usar defaults
    if (diapo.imgConfig) {
        imgConfig = { ...imgConfig, ...diapo.imgConfig };
    } else {
        imgConfig = { fit:'cover', w:35, h:55, r:8, pos:'top' };
    }
    mostrarControlesImagen(!esQuiz);
    if (!esQuiz) sincronizarControlesImagen();
    const ultimo=indiceSubapartadoActual===listaSubapartadosGlobal.length-1&&tipoDiapositivaActual==='quiz';
    // Actualizar texto del botón siguiente (está arriba)
    const btnTop = document.getElementById('btn-diapo-siguiente-top');
    if (btnTop) btnTop.textContent = ultimo ? '💾' : '→';
    const prog=((indiceSubapartadoActual*3+['resumen','ejemplo','quiz'].indexOf(tipoDiapositivaActual)+1)/(listaSubapartadosGlobal.length*3))*100;
    const bar=document.getElementById('progress-fill'); if(bar) bar.style.width=Math.min(prog,100)+'%';
}
function renderizarGaleria(imagenes,seleccionada) {
    const c=document.getElementById('gallery-container'); c.innerHTML='';
    if(tipoDiapositivaActual==='quiz'){ c.innerHTML=`<p style="color:var(--fog);font-size:.83rem;text-align:center;padding:18px">Vista Quiz: sin imagen.</p>`; return; }
    (imagenes||[]).forEach(url=>{
        const d=document.createElement('div');
        d.className='gal-item'+(url===seleccionada?' sel':'');
        d.innerHTML=`<img src="${url}" loading="lazy">`;
        d.onclick=()=>{
            const s=listaSubapartadosGlobal[indiceSubapartadoActual].subapartado;
            contenidoDiapositivas[s][tipoDiapositivaActual].img=url;
            document.getElementById('slide-img-src').src=url;
            // Marcar seleccionada visualmente sin re-renderizar todo
            document.querySelectorAll('.gal-item').forEach(el=>el.classList.remove('selected'));
            d.classList.add('sel');
        };
        c.appendChild(d);
    });
}
function cambiarTipoDiapo(t){ tipoDiapositivaActual=t; renderizarDiapositivaActual(); }
function actualizarTextoDesdeEditor(v){
    const s = listaSubapartadosGlobal[indiceSubapartadoActual].subapartado;
    contenidoDiapositivas[s][tipoDiapositivaActual].texto = v;
    // Re-renderizar las dos zonas
    const partes  = v.split('\n\n');
    const intro   = partes[0] || '';
    const puntos  = partes.slice(1).join('\n').split('\n').filter(l => l.startsWith('•'));
    const detalle = partes.slice(1).join('\n').split('\n').filter(l => !l.startsWith('•') && l.trim()).join('\n');
    const pEl = document.getElementById('slide-text-content');
    if (pEl) pEl.innerText = intro + (puntos.length ? '\n\n' + puntos.join('\n') : '');
    const dEl = document.getElementById('slide-text-detail');
    if (dEl) { dEl.innerText = detalle; dEl.style.display = detalle ? 'block' : 'none'; }
}
function actualizarGuionDesdeEditor(v){ const s=listaSubapartadosGlobal[indiceSubapartadoActual].subapartado; contenidoDiapositivas[s][tipoDiapositivaActual].script=v; }
function cambiarEstilo(e){
    const s = listaSubapartadosGlobal[indiceSubapartadoActual].subapartado;
    contenidoDiapositivas[s][tipoDiapositivaActual].style = e;
    const slideEl = document.getElementById('slide-render');
    slideEl.style.background = estilosFondos[e] || Object.values(estilosFondos)[0];
    slideEl.setAttribute('data-pattern', ESTILOS_TRAMA[e] || 'dots');
    document.getElementById('edit-slide-style').value = e;
}
// Alias para compatibilidad HTML
function cambiarEstiloBloqueActual(e){ cambiarEstilo(e); }

async function ejecutarBusquedaManualImagenes() {
    const q=document.getElementById('txt-busqueda-manual-img').value.trim(); if(!q)return;
    const sub=listaSubapartadosGlobal[indiceSubapartadoActual].subapartado;
    mostrarToast('🔎 Buscando imágenes...');
    const imgs=await buscarImagenes(q,6);
    contenidoDiapositivas[sub].imagenesDisponibles=imgs;
    contenidoDiapositivas[sub][tipoDiapositivaActual].img=imgs[0];
    renderizarDiapositivaActual();
}
async function ejecutarMagicIA(accion) {
    const sub=listaSubapartadosGlobal[indiceSubapartadoActual].subapartado;
    const texto=contenidoDiapositivas[sub][tipoDiapositivaActual].texto;
    mostrarCargando('El copiloto IA está reescribiendo...');
    const instr=accion==='simplificar'
        ?"Simplifica y aclara este texto educativo para mayor comprensión."
        :"Añade gamificación, metáforas y dinámicas de reto a este texto educativo.";
    const prompt=`${instr} Mantén estructura: oración intro + doble salto + viñetas con •.
Texto: "${texto}"
Devuelve SOLO: {"texto_nuevo":"..."}`;
    try {
        const r=await llamarGemini(prompt);
        if(r.texto_nuevo) contenidoDiapositivas[sub][tipoDiapositivaActual].texto=r.texto_nuevo;
        renderizarDiapositivaActual(); cambiarPantalla('screen-diapositivas');
        mostrarToast('✨ Contenido actualizado.');
    } catch(err){ mostrarToast('⚠️ '+err.message,'error'); cambiarPantalla('screen-diapositivas'); }
}
function navegarDiapositivas(dir) {
    if(dir===1){
        if(tipoDiapositivaActual==='resumen')       cambiarTipoDiapo('ejemplo');
        else if(tipoDiapositivaActual==='ejemplo')  cambiarTipoDiapo('quiz');
        else{ if(indiceSubapartadoActual<listaSubapartadosGlobal.length-1){ indiceSubapartadoActual++; cambiarTipoDiapo('resumen'); } else guardarEnCarpeta(true); }
    } else {
        if(tipoDiapositivaActual==='quiz')          cambiarTipoDiapo('ejemplo');
        else if(tipoDiapositivaActual==='ejemplo')  cambiarTipoDiapo('resumen');
        else if(indiceSubapartadoActual>0)          { indiceSubapartadoActual--; cambiarTipoDiapo('quiz'); }
    }
}
function guardarEnCarpeta(notificar) {
    if(!datosCurriculares.tema) return;
    const c=obtenerCarpetasLocales();
    c[datosCurriculares.tema]={ datosCurriculares, listaSubapartadosGlobal, contenidoDiapositivas, fechaGuardado:new Date().toISOString() };
    localStorage.setItem(`aprendia_temas_${usuarioActivo}`,JSON.stringify(c));
    if(notificar){ mostrarToast(`✅ "${datosCurriculares.tema}" guardado.`); mostrarPantallaCarpetas(); }
}
// Alias usado en el HTML antiguo
function guardarTodoEnCarpetaHistorial(n){ guardarEnCarpeta(n); }

// =========================================================================
//  VÍDEO NARRADO -- Canvas + MediaRecorder + Web Speech API
//  Genera MP4/WebM descargable con diapositivas + audio narrado
//  Opción: avatar (foto del usuario) hablando en esquina
// =========================================================================

let avatarDataURL = null; // foto del usuario como avatar

function abrirModalVideo() {
    document.getElementById('audio-resultado-wrap').style.display = 'none';
    document.getElementById('audio-list-container').innerHTML = '';
    // Restaurar botón
    const btn = document.getElementById('btn-generar-video');
    if (btn) { btn.disabled = false; btn.textContent = '🎬 Generar Vídeo'; }
    document.getElementById('modal-video').style.display = 'flex';
}

function cerrarModal(id) {
    document.getElementById(id).style.display = 'none';
}

function seleccionarVoz(v) {
    vozSeleccionada = v;
    document.querySelectorAll('.voice-btn').forEach(b => b.classList.remove('on'));
    const el = document.getElementById('voz-' + v);
    if (el) el.classList.add('on');
}

function cargarAvatarImagen(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        avatarDataURL = e.target.result;
        const prev = document.getElementById('avatar-preview');
        if (prev) {
            prev.src = avatarDataURL;
            prev.style.display = 'block';
        }
        mostrarToast('✅ Avatar cargado.');
    };
    reader.readAsDataURL(file);
    input.value = '';
}

async function generarVideoNarrado() {
    const detalle   = document.getElementById('video-detalle').value;
    const modoSeleccionado = document.querySelector('input[name="video-modo"]:checked')?.value || 'diapositivas';
    const conAvatar = modoSeleccionado === 'avatar' && avatarDataURL;
    const btn       = document.getElementById('btn-generar-video');
    btn.disabled    = true;
    btn.textContent = '⏳ Generando guiones...';
    mostrarToast('🎬 Generando narración con IA...');

    // 1. Generar guiones
    const instrDetalle = {
        conciso:    "Resume en 3-4 frases el contenido de esta diapositiva para narrarla en voz.",
        detallado:  "Explica en 6-8 frases el contenido de esta diapositiva con contexto para narrarla.",
        exhaustivo: "Desarrolla en 10-12 frases con ejemplos y analogías para una narración completa."
    };

    const guiones = {};
    for (const item of listaSubapartadosGlobal) {
        const sub    = item.subapartado;
        const bloque = contenidoDiapositivas[sub];
        if (!bloque) continue;
        const prompt = `${instrDetalle[detalle]}
Título: "${sub}"
Contenido: ${bloque.resumen.texto}
Devuelve SOLO: {"narracion":"texto natural para leer en voz alta"}`;
        try {
            const r = await llamarGemini(prompt);
            guiones[sub] = r.narracion || bloque.resumen.script;
        } catch(_) {
            guiones[sub] = bloque.resumen.script || sub;
        }
    }

    btn.textContent = '🎬 Renderizando vídeo...';
    mostrarToast('🎬 Renderizando diapositivas...');

    // 2. Renderizar vídeo con Canvas + MediaRecorder
    try {
        await renderizarVideoCanvas(guiones, conAvatar);
    } catch(err) {
        mostrarToast('❌ Error: ' + err.message, 'error');
        btn.disabled   = false;
        btn.textContent = '🎬 Generar Vídeo';
    }
}

async function renderizarVideoCanvas(guiones, conAvatar) {
    // Configuración canvas 16:9
    const W = 1280, H = 720;
    const canvas  = document.createElement('canvas');
    canvas.width  = W; canvas.height = H;
    const ctx     = canvas.getContext('2d');

    // MediaRecorder para grabar canvas + audio
    const stream        = canvas.captureStream(30);
    const audioCtx      = new (window.AudioContext || window.webkitAudioContext)();
    const audioDestNode = audioCtx.createMediaStreamDestination();
    stream.addTrack(audioDestNode.stream.getAudioTracks()[0]);

    const mimeType  = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4'
                    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
                    : 'video/webm';
    const recorder  = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3000000 });
    const chunks    = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.start(100);

    // Cargar avatar si existe
    let avatarImg = null;
    if (conAvatar && avatarDataURL) {
        avatarImg = await cargarImagen(avatarDataURL);
    }

    // Precargar imágenes de diapositivas
    const imgCache = {};
    for (const item of listaSubapartadosGlobal) {
        const sub = item.subapartado;
        const img = contenidoDiapositivas[sub]?.resumen?.img;
        if (img) {
            try { imgCache[sub] = await cargarImagen(img); } catch(_) {}
        }
    }

    // Renderizar cada diapositiva
    for (let idx = 0; idx < listaSubapartadosGlobal.length; idx++) {
        const item   = listaSubapartadosGlobal[idx];
        const sub    = item.subapartado;
        const bloque = contenidoDiapositivas[sub];
        const texto  = guiones[sub] || sub;

        // Dibujar diapositiva en canvas
        dibujarSlideCanvas(ctx, W, H, sub, item.padre, bloque, imgCache[sub], avatarImg, idx, listaSubapartadosGlobal.length);

        // Narrar con Web Speech y esperar a que termine
        await narrarConCanvas(texto, audioCtx, audioDestNode);

        // Pausa de 0.5s entre diapositivas
        await new Promise(r => setTimeout(r, 500));
    }

    // Diapositiva final
    dibujarSlideFinal(ctx, W, H);
    await new Promise(r => setTimeout(r, 2000));

    // Parar grabación y descargar
    recorder.stop();
    await new Promise(resolve => { recorder.onstop = resolve; });

    const ext  = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Video_AprendIA_${datosCurriculares.tema.replace(/\s+/g,'_')}.${ext}`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    mostrarToast(`✅ Vídeo descargado (.${ext})`);
    const btn = document.getElementById('btn-generar-video');
    if (btn) { btn.disabled = false; btn.textContent = '🎬 Generar Vídeo'; }

    // Mostrar audios individuales también
    mostrarAudiosIndividuales(guiones);
}

function cargarImagen(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload  = () => resolve(img);
        img.onerror = () => reject(new Error('img'));
        img.src = src;
    });
}

function narrarConCanvas(texto, audioCtx, destNode) {
    return new Promise(resolve => {
        if (!('speechSynthesis' in window)) { setTimeout(resolve, 2000); return; }
        speechSynthesis.cancel();
        const utt   = new SpeechSynthesisUtterance(texto);
        utt.lang    = 'es-ES'; utt.rate = 0.88; utt.pitch = 1;
        const voices = speechSynthesis.getVoices();
        const match  = voices.find(v => v.lang.startsWith('es'));
        if (match) utt.voice = match;
        utt.onend  = () => setTimeout(resolve, 300);
        utt.onerror = () => resolve();
        speechSynthesis.speak(utt);
    });
}

// Paleta de colores para slides en canvas
const SLIDE_PALETTES = [
    { bg:'#dbeafe', accent:'#3b82f6', dark:'#1e3a5f', text:'#1e293b' },
    { bg:'#dcfce7', accent:'#16a34a', dark:'#14532d', text:'#1e293b' },
    { bg:'#fce7f3', accent:'#ec4899', dark:'#831843', text:'#1e293b' },
    { bg:'#fef3c7', accent:'#d97706', dark:'#78350f', text:'#1e293b' },
    { bg:'#ede9fe', accent:'#7c3aed', dark:'#4c1d95', text:'#1e293b' },
    { bg:'#ccfbf1', accent:'#0d9488', dark:'#134e4a', text:'#1e293b' },
    { bg:'#ffedd5', accent:'#ea580c', dark:'#7c2d12', text:'#1e293b' },
    { bg:'#f1f5f9', accent:'#475569', dark:'#1e293b', text:'#1e293b' },
];

function dibujarSlideCanvas(ctx, W, H, titulo, padre, bloque, imgSlide, avatarImg, idx, total) {
    const pal = SLIDE_PALETTES[idx % SLIDE_PALETTES.length];

    // Fondo
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);

    // Patrón punteado sutil
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    for (let x = 0; x < W; x += 32) for (let y = 0; y < H; y += 32)
        ctx.fillRect(x, y, 1.5, 1.5);

    // Barra lateral izquierda
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, 0, 6, H);

    // Cabecera: badge padre
    roundRect(ctx, 24, 24, 200, 28, 6, pal.accent);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px "Arial"';
    ctx.fillText(padre.substring(0, 25).toUpperCase(), 34, 43);

    // Número / total
    ctx.fillStyle = pal.accent + '33';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${idx+1}/${total}`, W - 30, 100);
    ctx.textAlign = 'left';

    // Título
    ctx.fillStyle = pal.dark;
    ctx.font = 'bold 36px Arial';
    wrapText(ctx, titulo, 24, 90, W * 0.65, 44);

    // Separador
    ctx.fillStyle = pal.accent;
    ctx.fillRect(24, 150, W * 0.6, 2);

    // Texto (intro + puntos)
    const partes   = (bloque?.resumen?.texto || '').split('\n\n');
    const intro    = partes[0] || '';
    const puntos   = partes.slice(1).join('\n').split('\n').filter(l => l.trim());
    
    ctx.fillStyle = pal.text;
    ctx.font = '16px Arial';
    let y = 175;
    // intro
    y = wrapText(ctx, intro, 24, y, W * 0.6, 22) + 12;
    // puntos
    ctx.font = '15px Arial';
    puntos.slice(0, 5).forEach(p => {
        // bullet
        ctx.fillStyle = pal.accent;
        ctx.fillRect(24, y - 10, 3, 14);
        ctx.fillStyle = pal.text;
        y = wrapText(ctx, p.replace(/^[•\-]\s*/, ''), 34, y, W * 0.58, 20) + 6;
        if (y > H - 80) return;
    });

    // Imagen de la diapositiva (derecha)
    if (imgSlide) {
        const ix = W * 0.66, iy = 60, iw = W * 0.31, ih = H * 0.55;
        ctx.save();
        roundRect(ctx, ix, iy, iw, ih, 12, null, true);
        ctx.clip();
        ctx.drawImage(imgSlide, ix, iy, iw, ih);
        ctx.restore();
        // Marco
        ctx.strokeStyle = pal.accent + '66';
        ctx.lineWidth   = 2;
        roundRectStroke(ctx, ix, iy, iw, ih, 12);
    }

    // Avatar (esquina inf derecha si existe)
    if (avatarImg) {
        const ar = 100;
        ctx.save();
        ctx.beginPath();
        ctx.arc(W - 70, H - 70, ar/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, W - 70 - ar/2, H - 70 - ar/2, ar, ar);
        ctx.restore();
        // Anillo
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.arc(W - 70, H - 70, ar/2 + 3, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Pie
    ctx.fillStyle = pal.text + '66';
    ctx.font      = '12px Arial';
    ctx.fillText(`AprendIA · ${datosCurriculares.tema}`, 24, H - 16);

    // Barra de progreso
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, H - 6, W, 6);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, H - 6, W * ((idx + 1) / total), 6);
}

function dibujarSlideFinal(ctx, W, H) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, 'rgba(124,92,252,0.2)');
    grad.addColorStop(1, 'rgba(0,212,255,0.1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f0efff';
    ctx.font      = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(datosCurriculares.tema, W/2, H/2 - 30);
    ctx.font      = '22px Arial';
    ctx.fillStyle = '#8080b0';
    ctx.fillText('Generado con AprendIA · OpenRouter AI', W/2, H/2 + 30);
    ctx.textAlign = 'left';
}

// Helpers canvas
function roundRect(ctx, x, y, w, h, r, fill, clipOnly = false) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (!clipOnly) { if (fill) { ctx.fillStyle = fill; } ctx.fill(); }
}

function roundRectStroke(ctx, x, y, w, h, r) {
    roundRect(ctx, x, y, w, h, r, null, true);
    ctx.stroke();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
    if (!text) return y;
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line, x, y);
            line = word + ' ';
            y += lineH;
        } else { line = test; }
    }
    if (line.trim()) { ctx.fillText(line, x, y); y += lineH; }
    return y;
}

function mostrarAudiosIndividuales(guiones) {
    const wrap  = document.getElementById('audio-resultado-wrap');
    const lista = document.getElementById('audio-list-container');
    if (!wrap || !lista) return;
    wrap.style.display = 'block';
    lista.innerHTML    = '';

    listaSubapartadosGlobal.forEach((item, idx) => {
        const sub   = item.subapartado;
        const texto = guiones[sub] || '';
        const div   = document.createElement('div');
        div.className = 'audio-item';
        div.innerHTML = `
            <div class="audio-label">📌 ${idx+1}. ${sub}</div>
            <div class="audio-exc">${texto.substring(0,110)}...</div>
            <button type="button" class="btn-play"
                onclick="reproducirFragmento('${sub}', this)"
                data-texto="${encodeURIComponent(texto)}">▶ Escuchar</button>`;
        lista.appendChild(div);
    });
}

function reproducirFragmento(sub, btn) {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    const texto = decodeURIComponent(btn.getAttribute('data-texto'));
    const utt   = new SpeechSynthesisUtterance(texto);
    utt.lang    = 'es-ES'; utt.rate = 0.9; utt.pitch = 1;
    const voices = speechSynthesis.getVoices();
    const match  = voices.find(v => v.lang.startsWith('es'));
    if (match) utt.voice = match;
    btn.textContent = '⏸ Reproduciendo...';
    utt.onend = () => { btn.textContent = '▶ Escuchar'; };
    speechSynthesis.speak(utt);
}

async function reproducirTodoElAudio(guiones) {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    for (const item of listaSubapartadosGlobal) {
        const texto = guiones[item.subapartado] || '';
        await new Promise(resolve => {
            const utt = new SpeechSynthesisUtterance(texto);
            utt.lang = 'es-ES'; utt.rate = 0.9;
            const voices = speechSynthesis.getVoices();
            const match  = voices.find(v => v.lang.startsWith('es'));
            if (match) utt.voice = match;
            utt.onend = resolve;
            speechSynthesis.speak(utt);
        });
        await new Promise(r => setTimeout(r, 500));
    }
}

// =========================================================================
//  MODAL -- GUION COMPLETO DEL PROFESOR
// =========================================================================
function abrirModalGuion() {
    const render = document.getElementById('guion-content-render');
    render.innerHTML = '';

    // Cabecera
    const cab = document.createElement('div');
    cab.className = 'g-section';
    cab.innerHTML = `<div class="g-title" style="font-size:1.1rem;color:var(--snow)">📖 Guion Completo -- ${datosCurriculares.tema}</div>
        <div class="g-text" style="color:var(--fog)">Nivel: ${datosCurriculares.nivel.toUpperCase()} · Duración: ${datosCurriculares.duracion} · Estilo: ${datosCurriculares.estilo}</div>`;
    render.appendChild(cab);

    let tiempoTotal = 0;
    listaSubapartadosGlobal.forEach((item, idx) => {
        const sub   = item.subapartado;
        const bloque= contenidoDiapositivas[sub];
        if (!bloque) return;
        const tiempoSub = (bloque.resumen.estimacion_minutos||5) + (bloque.ejemplo.estimacion_minutos||5) + 3;
        tiempoTotal += tiempoSub;

        const sec = document.createElement('div');
        sec.className = 'g-section';
        sec.innerHTML = `
            <div class="g-title">
                ${idx+1}. ${sub}
                <span style="font-size:.72rem;color:var(--fog);font-weight:400;margin-left:8px">≈${tiempoSub} min</span>
            </div>
            <div style="margin-bottom:8px">
                <span class="guion-tag guion-tag-resumen">PUNTOS CLAVE</span>
                <div class="g-text">${bloque.resumen.texto}</div>
                <div style="margin-top:6px;padding:8px 12px;background:rgba(99,102,241,.06);border-left:2px solid var(--accent);border-radius:0 6px 6px 0;font-size:.83rem;color:var(--fog)">${bloque.resumen.script}</div>
            </div>
            <div style="margin-bottom:8px">
                <span class="guion-tag guion-tag-ejemplo">CASO PRÁCTICO</span>
                <div class="g-text">${bloque.ejemplo.texto}</div>
                <div style="margin-top:6px;padding:8px 12px;background:rgba(52,211,153,.05);border-left:2px solid var(--success);border-radius:0 6px 6px 0;font-size:.83rem;color:var(--fog)">${bloque.ejemplo.script}</div>
            </div>
            <div>
                <span class="guion-tag guion-tag-quiz">EVALUACIÓN</span>
                <div class="g-text">${bloque.quiz.texto}</div>
                <div style="margin-top:6px;padding:8px 12px;background:rgba(248,113,113,.05);border-left:2px solid var(--danger);border-radius:0 6px 6px 0;font-size:.83rem;color:var(--fog)">${bloque.quiz.script}</div>
            </div>`;
        render.appendChild(sec);
    });

    // Pie con tiempo total
    const pie = document.createElement('div');
    pie.style.cssText = 'text-align:center;padding:14px;border-top:1px solid var(--rim);margin-top:10px;color:var(--fog);font-size:.78rem';
    pie.innerHTML = `⏱ Tiempo total: <strong style="color:var(--v2)">${tiempoTotal} min</strong> · ${listaSubapartadosGlobal.length} píldoras didácticas`;
    render.appendChild(pie);

    document.getElementById('modal-guion').style.display = 'flex';
}

function descargarGuion() {
    const sep = '='.repeat(50);
    const sep2 = '-'.repeat(50);
    let texto = 'GUION COMPLETO DEL PROFESOR\n';
    texto += 'AprendIA - Gemini AI\n';
    texto += sep + '\n\n';
    texto += 'TEMA: ' + datosCurriculares.tema + '\n';
    texto += 'NIVEL: ' + datosCurriculares.nivel + ' | DURACION: ' + datosCurriculares.duracion + '\n';
    texto += 'ENFOQUE: ' + datosCurriculares.estilo + '\n\n';

    listaSubapartadosGlobal.forEach((item, idx) => {
        const sub   = item.subapartado;
        const bloque = contenidoDiapositivas[sub];
        if (!bloque) return;
        texto += sep2 + '\n';
        texto += (idx+1) + '. ' + sub.toUpperCase() + '\n';
        texto += sep2 + '\n\n';
        texto += '[PUNTOS CLAVE]\n' + bloque.resumen.texto + '\n\n';
        texto += '[GUION DOCENTE -- PUNTOS CLAVE]\n' + bloque.resumen.script + '\n\n';
        texto += '[CASO PRACTICO]\n' + bloque.ejemplo.texto + '\n\n';
        texto += '[GUION DOCENTE -- CASO PRACTICO]\n' + bloque.ejemplo.script + '\n\n';
        texto += '[EVALUACION]\n' + bloque.quiz.texto + '\n\n';
        texto += '[RESPUESTA Y JUSTIFICACION]\n' + bloque.quiz.script + '\n\n';
    });

    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'Guion_AprendIA_' + datosCurriculares.tema.replace(/\s+/g, '_') + '.txt';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    mostrarToast('Guion descargado.');
}


function descargarInformeCorreccion(resultados) {
    const sep = '='.repeat(50);
    let txt = 'INFORME DE CORRECCION -- ' + datosCurriculares.tema + '\n';
    txt += 'Generado con AprendIA - ' + new Date().toLocaleDateString('es-ES') + '\n';
    txt += sep + '\n\n';
    resultados.forEach((a, i) => {
        txt += (i+1) + '. ' + (a.nombre || 'Alumno') + ' -- Nota: ' + a.nota_sobre_10 + '/10\n';
        txt += '   ' + (a.comentario_general || '') + '\n';
        (a.correcciones || []).forEach(c => {
            txt += '   P' + c.pregunta + ' [' + (c.correcto ? 'OK' : 'X') + ']: ' + c.observacion + '\n';
        });
        txt += '\n';
    });
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'Informe_Correccion_' + datosCurriculares.tema.replace(/\s+/g, '_') + '.txt';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

n
// == EXPONER FUNCIONES GLOBALES ==
window.handleLogin = handleLogin;
window.handleConfig = handleConfig;
window.handleGuardarAPIs = handleGuardarAPIs;
window.mostrarPantallaCarpetas = mostrarPantallaCarpetas;
window.mostrarPantallaAPIs = mostrarPantallaAPIs;
window.cambiarPantalla = cambiarPantalla;
window.ejecutarCierreSesion = ejecutarCierreSesion;
window.instalarPWA = instalarPWA;
window.navegarDiapositivas = navegarDiapositivas;
window.cambiarTipoDiapo = cambiarTipoDiapo;
window.navegarApartado = navegarApartado;
window.guardarApartadosSiguiente = guardarApartadosSiguiente;
window.agregarApartado = agregarApartado;
window.eliminarApartado = eliminarApartado;
window.agregarSubapartado = agregarSubapartado;
window.eliminarSubapartado = eliminarSubapartado;
window.cambiarEstilo = cambiarEstilo;
window.cambiarEstiloBloqueActual = cambiarEstilo;
window.ejecutarMagicIA = ejecutarMagicIA;
window.ejecutarBusquedaManualImagenes = ejecutarBusquedaManualImagenes;
window.actualizarTextoDesdeEditor = actualizarTextoDesdeEditor;
window.actualizarGuionDesdeEditor = actualizarGuionDesdeEditor;
window.exportarClaseAPowerPoint = exportarClaseAPowerPoint;
window.exportarExamenWord = exportarExamenWord;
window.abrirModalVideo = abrirModalVideo;
window.abrirModalGuion = abrirModalGuion;
window.abrirModalForms = abrirModalForms;
window.cerrarModal = cerrarModal;
window.seleccionarVoz = seleccionarVoz;
window.generarVideoNarrado = generarVideoNarrado;
window.reproducirFragmento = reproducirFragmento;
window.descargarGuion = descargarGuion;
window.generarFormsTexto = generarFormsTexto;
window.copiarFormsTexto = copiarFormsTexto;
window.descargarFormsTxt = descargarFormsTxt;
window.corregirRespuestasSheet = corregirRespuestasSheet;
window.guardarEnCarpeta = guardarEnCarpeta;
window.guardarTodoEnCarpetaHistorial = guardarEnCarpeta;
window.subirImagenPropia = subirImagenPropia;
window.cambiarFitImagen = cambiarFitImagen;
window.cambiarPosImagen = cambiarPosImagen;
window.ajustarImagen = ajustarImagen;
window.cargarAvatarImagen = cargarAvatarImagen;
window.eliminarCarpeta = eliminarCarpeta;
window.verArchivosDeCarpeta = verArchivosDeCarpeta;
window.cargarWorkspaceDesdeCarpeta = cargarWorkspaceDesdeCarpeta;
window.descargarPPTXDesdeCarpeta = descargarPPTXDesdeCarpeta;
window.descargarExamenDesdeCarpeta = descargarExamenDesdeCarpeta;
window.verGuionDesdeCarpeta = verGuionDesdeCarpeta;
window.abrirVideoDesdeCarpeeta = abrirVideoDesdeCarpeeta;
window.abrirFormsDesdeCarpeeta = abrirFormsDesdeCarpeeta;
window.subirPPTXADrive = subirPPTXADrive;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.agregarArchivos = agregarArchivos;
window.eliminarArchivo = eliminarArchivo;
