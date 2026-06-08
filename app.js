// =========================================================================
//  AprendIA — Multi-API: Gemini + Unsplash + Pexels + Drive
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
// Trama SVG asociada a cada fondo — da personalidad visual única
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
document.addEventListener("DOMContentLoaded", () => {
    registrarServiceWorker();
    configurarInstalacionPWA();

    // Listeners con null-check (el HTML puede no tener todos los elementos)
    const addL = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
    addL('form-login',  'submit', handleLogin);
    addL('form-config', 'submit', handleConfig);
    addL('form-apis',   'submit', handleGuardarAPIs);

    // Verificar sesión guardada DESPUÉS de registrar los listeners
    verificarSesionGuardada();
});

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
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-password').value.trim();
    const gkey  = document.getElementById('login-key').value.trim();
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
    const emailEl = document.getElementById('txt-user-email');
    if (emailEl) emailEl.innerText = usuarioActivo;
    const navbar = document.getElementById('global-navbar');
    if (navbar) navbar.style.display = 'flex';
    actualizarIndicadoresAPIs();
    revisarTokenOAuthEnURL();
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
        r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKeys.gemini}`,
                'HTTP-Referer': 'https://aprendia.app',
                'X-Title': 'AprendIA'
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
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
                'HTTP-Referer': 'https://aprendia.app',
                'X-Title': 'AprendIA'
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
// por lo que usamos Web Speech API (SpeechSynthesis) del navegador — funciona offline,
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
//  CONTROLES DE IMAGEN — subir, ajustar, encajar
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
    // Fallback: Wikimedia Commons API — imágenes reales relacionadas con el tema
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
//  FASE 1 — CONFIGURACIÓN
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
        mostrarCargando(`Generando material ${i+1}–${Math.min(i+LOTE,listaSubapartadosGlobal.length)} de ${listaSubapartadosGlobal.length}...`);
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
//  MODAL — VÍDEO NARRADO
// =========================================================================
function abrirModalVideo() {
    document.getElementById('audio-resultado-wrap').style.display='none';
    document.getElementById('audio-list-container').innerHTML='';
    document.getElementById('modal-video').style.display='flex';
}
function cerrarModal(id) { document.getElementById(id).style.display='none'; }
function seleccionarVoz(v) {
    vozSeleccionada=v;
    document.querySelectorAll('.voice-btn').forEach(b=>b.classList.remove('selected'));
    document.getElementById('voz-'+v).classList.add('selected');
}

async function generarVideoNarrado() {
    const detalle = document.getElementById('video-detalle').value;
    const btn     = document.getElementById('btn-generar-video');
    btn.disabled  = true;
    btn.textContent = '⏳ Generando guiones...';

    mostrarToast('🎬 Generando guiones de narración con Gemini...');

    // 1. Generar guiones de narración para cada diapositiva via Gemini
    const guionesNarracion = {};
    const instrDetalle = {
        conciso:    "Resume en 3-4 frases el contenido de esta diapositiva para narrarla en voz.",
        detallado:  "Explica en 6-8 frases el contenido de esta diapositiva con contexto y ejemplos para narrarla en voz.",
        exhaustivo: "Desarrolla en 10-14 frases el contenido de esta diapositiva con ejemplos, analogías y ampliaciones para una narración educativa completa."
    };

    for (const item of listaSubapartadosGlobal) {
        const sub   = item.subapartado;
        const bloque= contenidoDiapositivas[sub];
        if (!bloque) continue;

        const prompt = `Eres un narrador educativo experto. ${instrDetalle[detalle]}
Título: "${sub}"
Puntos clave: ${bloque.resumen.texto}
Caso práctico: ${bloque.ejemplo.texto}
Quiz: ${bloque.quiz.texto}

Devuelve SOLO: {"narracion":"texto corrido natural para leer en voz alta, sin viñetas ni markdown"}`;
        try {
            const r = await llamarGemini(prompt);
            guionesNarracion[sub] = r.narracion || bloque.resumen.script;
        } catch(_) {
            guionesNarracion[sub] = bloque.resumen.script + " " + bloque.ejemplo.script;
        }
    }

    // 2. Mostrar reproductores de audio usando Web Speech API
    btn.textContent = '▶ Reproducir Todo';
    btn.disabled    = false;
    btn.onclick     = () => reproducirTodoElAudio(guionesNarracion);

    const wrap  = document.getElementById('audio-resultado-wrap');
    const lista = document.getElementById('audio-list-container');
    wrap.style.display = 'block';
    lista.innerHTML    = '';

    listaSubapartadosGlobal.forEach((item, idx) => {
        const sub  = item.subapartado;
        const texto= guionesNarracion[sub] || '';
        const div  = document.createElement('div');
        div.className = 'audio-item';
        div.innerHTML = `
            <div class="audio-label">📌 ${idx+1}. ${sub}</div>
            <div style="font-size:.78rem;color:var(--fog);margin-bottom:8px;line-height:1.5">${texto.substring(0,120)}...</div>
            <button type="button" style="width:auto;padding:7px 16px;font-size:.82rem;margin:0;background:rgba(99,102,241,.12);color:var(--v2);border:1px solid rgba(99,102,241,.25);border-radius:8px"
                onclick="reproducirFragmento('${sub}', this)" data-texto="${encodeURIComponent(texto)}">
                ▶ Escuchar
            </button>`;
        lista.appendChild(div);
    });

    mostrarToast('✅ Guiones de narración listos. Pulsa ▶ para escuchar.');
}

function reproducirFragmento(sub, btn) {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    const texto = decodeURIComponent(btn.getAttribute('data-texto'));
    const utt   = new SpeechSynthesisUtterance(texto);
    utt.lang    = 'es-ES';
    utt.rate    = 0.9;
    utt.pitch   = 1;
    const voices= speechSynthesis.getVoices();
    const match = voices.find(v=>v.lang.startsWith('es'));
    if (match) utt.voice = match;
    btn.textContent='⏸ Reproduciendo...';
    utt.onend = () => { btn.textContent='▶ Escuchar'; };
    speechSynthesis.speak(utt);
}

async function reproducirTodoElAudio(guiones) {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    for (const item of listaSubapartadosGlobal) {
        const sub   = item.subapartado;
        const texto = guiones[sub] || '';
        await new Promise(resolve => {
            const utt   = new SpeechSynthesisUtterance(texto);
            utt.lang    = 'es-ES'; utt.rate=0.9; utt.pitch=1;
            const voices= speechSynthesis.getVoices();
            const match = voices.find(v=>v.lang.startsWith('es'));
            if(match) utt.voice=match;
            utt.onend = resolve;
            speechSynthesis.speak(utt);
        });
        await new Promise(r=>setTimeout(r,600)); // pausa entre diapositivas
    }
}

// =========================================================================
//  MODAL — GUION COMPLETO DEL PROFESOR
// =========================================================================
function abrirModalGuion() {
    const render = document.getElementById('guion-content-render');
    render.innerHTML = '';

    // Cabecera
    const cab = document.createElement('div');
    cab.className = 'g-section';
    cab.innerHTML = `<div class="g-title" style="font-size:1.1rem;color:var(--snow)">📖 Guion Completo — ${datosCurriculares.tema}</div>
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
    let texto = `GUION COMPLETO DEL PROFESOR\n`;
    texto    += `AprendIA · Gemini AI\n`;
    texto    += `${'='.repeat(60)}\n\n`;
    texto    += `TEMA: ${datosCurriculares.tema}\n`;
    texto    += `NIVEL: ${datosCurriculares.nivel} | DURACIÓN: ${datosCurriculares.duracion}\n`;
    texto    += `ENFOQUE: ${datosCurriculares.estilo}\n\n`;

    listaSubapartadosGlobal.forEach((item, idx) => {
        const sub   = item.subapartado;
        const bloque= contenidoDiapositivas[sub];
        if (!bloque) return;
        texto += `${'─'.repeat(50)}\n`;
        texto += `${idx+1}. ${sub.toUpperCase()}\n`;
        texto += `${'─'.repeat(50)}\n\n`;
        texto += `[PUNTOS CLAVE]\n${bloque.resumen.texto}\n\n`;
        texto += `[GUION DOCENTE — PUNTOS CLAVE]\n${bloque.resumen.script}\n\n`;
        texto += `[CASO PRÁCTICO]\n${bloque.ejemplo.texto}\n\n`;
        texto += `[GUION DOCENTE — CASO PRÁCTICO]\n${bloque.ejemplo.script}\n\n`;
        texto += `[EVALUACIÓN]\n${bloque.quiz.texto}\n\n`;
        texto += `[RESPUESTA Y JUSTIFICACIÓN]\n${bloque.quiz.script}\n\n`;
    });

    const blob = new Blob([texto], { type:'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Guion_AprendIA_${datosCurriculares.tema.replace(/\s+/g,'_')}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    mostrarToast('📖 Guion descargado.');
}

// =========================================================================
//  EXPORTAR PPTX — DISEÑO PROFESIONAL
// =========================================================================

// Paleta de temas: cada apartado padre recibe uno diferente
const TEMAS_PPTX = [
    { bg:'1e293b', accent:'6366f1', light:'a5b4fc', tag:'ffffff', text:'e2e8f0' }, // Índigo oscuro
    { bg:'0f2027', accent:'06b6d4', light:'67e8f9', tag:'ffffff', text:'e0f7fa' }, // Cyan profundo
    { bg:'1a1a2e', accent:'8b5cf6', light:'c4b5fd', tag:'ffffff', text:'ede9fe' }, // Violeta
    { bg:'0d1f0d', accent:'22c55e', light:'86efac', tag:'ffffff', text:'dcfce7' }, // Verde bosque
    { bg:'1c0a00', accent:'f59e0b', light:'fcd34d', tag:'ffffff', text:'fef3c7' }, // Ámbar
    { bg:'1e0a2e', accent:'ec4899', light:'f9a8d4', tag:'ffffff', text:'fce7f3' }, // Rosa
    { bg:'0a1929', accent:'0ea5e9', light:'7dd3fc', tag:'ffffff', text:'e0f2fe' }, // Azul cielo
    { bg:'1a0a0a', accent:'ef4444', light:'fca5a5', tag:'ffffff', text:'fee2e2' }, // Rojo
];

function _hexFromStyle(style) {
    const map = {
        'azul-sereno':'dbeafe','verde-bosque':'dcfce7','rosa-suave':'fce7f3',
        'ambar-calido':'fef3c7','violeta-niebla':'ede9fe','teal-oceano':'ccfbf1',
        'naranja-atardecer':'ffedd5','gris-perla':'f1f5f9'
    };
    return map[style] || 'f1f5f9';
}

function _accentFromStyle(style) {
    const map = {
        'azul-sereno':'3b82f6','verde-bosque':'16a34a','rosa-suave':'ec4899',
        'ambar-calido':'d97706','violeta-niebla':'7c3aed','teal-oceano':'0d9488',
        'naranja-atardecer':'ea580c','gris-perla':'475569'
    };
    return map[style] || '6366f1';
}

function _darkFromStyle(style) {
    const map = {
        'azul-sereno':'1e3a5f','verde-bosque':'14532d','rosa-suave':'831843',
        'ambar-calido':'78350f','violeta-niebla':'4c1d95','teal-oceano':'134e4a',
        'naranja-atardecer':'7c2d12','gris-perla':'1e293b'
    };
    return map[style] || '1e293b';
}

// Parsea el texto en intro + viñetas
function _parsearTexto(texto) {
    const partes  = (texto||'').split('\n\n');
    const intro   = partes[0] || '';
    const lineas  = partes.slice(1).join('\n').split('\n').filter(Boolean);
    const puntos  = lineas.filter(l => l.trim().startsWith('•'));
    const detalle = lineas.filter(l => !l.trim().startsWith('•')).join(' ');
    return { intro, puntos, detalle };
}

function construirPPTX() {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.defineLayout({ name:'LAYOUT_16x9', width:13.33, height:7.5 });

    // ── PORTADA ──────────────────────────────────────────────────────────────
    const portada = pptx.addSlide();
    // Fondo degradado simulado con dos rectángulos
    portada.addShape(pptx.ShapeType.rect, { x:0, y:0, w:13.33, h:7.5, fill:{color:'0f172a'} });
    portada.addShape(pptx.ShapeType.rect, { x:0, y:0, w:6.5,  h:7.5, fill:{color:'6366f1'}, transparency:80 });
    // Línea decorativa
    portada.addShape(pptx.ShapeType.rect, { x:1, y:2.8, w:2.5, h:0.06, fill:{color:'6366f1'} });
    // Badge nivel
    portada.addShape(pptx.ShapeType.roundRect, { x:1, y:1.6, w:2.2, h:0.38, fill:{color:'6366f1'}, rectRadius:0.1 });
    portada.addText(datosCurriculares.nivel.toUpperCase(), {
        x:1, y:1.6, w:2.2, h:0.38,
        fontSize:9, bold:true, color:'ffffff', align:'center', valign:'middle', fontFace:'Calibri'
    });
    // Título
    portada.addText(datosCurriculares.tema, {
        x:1, y:2.1, w:11, h:2.2,
        fontSize:36, bold:true, color:'f8fafc', fontFace:'Calibri',
        valign:'middle', charSpacing:0.5
    });
    // Meta info
    portada.addText(`Duración: ${datosCurriculares.duracion}  ·  Enfoque: ${datosCurriculares.estilo}`, {
        x:1, y:4.5, w:9, h:0.4,
        fontSize:11, color:'94a3b8', fontFace:'Calibri', italic:true
    });
    // Marca
    portada.addText('AprendIA · OpenRouter AI', {
        x:1, y:6.8, w:6, h:0.4,
        fontSize:9, color:'475569', fontFace:'Calibri'
    });

    // ── DIAPOSITIVAS DE CONTENIDO ────────────────────────────────────────────
    let padreActual = '';
    let indicePadre = -1;

    listaSubapartadosGlobal.forEach((item, idxGlobal) => {
        const sub    = item.subapartado;
        const bloque = contenidoDiapositivas[sub];
        if (!bloque) return;

        // Cambio de apartado padre → diapositiva separadora
        if (item.padre !== padreActual) {
            padreActual  = item.padre;
            indicePadre  = (indicePadre + 1) % TEMAS_PPTX.length;
            const tema   = TEMAS_PPTX[indicePadre];
            const sep    = pptx.addSlide();
            sep.addShape(pptx.ShapeType.rect, { x:0, y:0, w:13.33, h:7.5, fill:{color:tema.bg} });
            sep.addShape(pptx.ShapeType.rect, { x:0, y:0, w:13.33, h:0.08, fill:{color:tema.accent} });
            sep.addShape(pptx.ShapeType.rect, { x:0, y:7.42, w:13.33, h:0.08, fill:{color:tema.accent} });
            // Número de bloque grande decorativo
            sep.addText(String(indicePadre + 1).padStart(2,'0'), {
                x:9, y:1, w:3.5, h:5, fontSize:140, bold:true,
                color:tema.accent, transparency:80, fontFace:'Calibri', align:'right'
            });
            sep.addText('MÓDULO', {
                x:1, y:2.4, w:4, h:0.4,
                fontSize:10, bold:true, color:tema.accent, fontFace:'Calibri', charSpacing:4
            });
            sep.addText(item.padre, {
                x:1, y:2.9, w:8.5, h:2.4,
                fontSize:34, bold:true, color:tema.tag, fontFace:'Calibri', valign:'top'
            });
            sep.addText(`${listaSubapartadosGlobal.filter(x=>x.padre===item.padre).length} subapartados`, {
                x:1, y:6.5, w:5, h:0.4,
                fontSize:10, color:tema.light, fontFace:'Calibri', italic:true
            });
        }

        const tema = TEMAS_PPTX[indicePadre];

        // ── SLIDE PUNTOS CLAVE ──
        _addSlidePro(pptx, sub, bloque.resumen, 'PUNTOS CLAVE', idxGlobal, tema);

        // ── SLIDE CASO PRÁCTICO ──
        _addSlidePro(pptx, sub, bloque.ejemplo, 'CASO PRÁCTICO', idxGlobal, tema);

        // ── SLIDE QUIZ ──────────
        _addSlideQuizPro(pptx, sub, bloque.quiz, idxGlobal, tema);
    });

    // ── CIERRE ───────────────────────────────────────────────────────────────
    const cierre = pptx.addSlide();
    cierre.addShape(pptx.ShapeType.rect, { x:0, y:0, w:13.33, h:7.5, fill:{color:'0f172a'} });
    cierre.addShape(pptx.ShapeType.rect, { x:0, y:3.5, w:13.33, h:0.04, fill:{color:'6366f1'} });
    cierre.addText('Fin de la presentación', {
        x:1, y:1.5, w:11, h:1.5, fontSize:36, bold:true,
        color:'f8fafc', fontFace:'Calibri', align:'center'
    });
    cierre.addText(`${datosCurriculares.tema} · ${listaSubapartadosGlobal.length} conceptos trabajados`, {
        x:1, y:3.2, w:11, h:0.6, fontSize:13,
        color:'64748b', fontFace:'Calibri', align:'center', italic:true
    });
    cierre.addText('Generado con AprendIA', {
        x:1, y:6.8, w:11, h:0.4, fontSize:9,
        color:'334155', fontFace:'Calibri', align:'center'
    });

    return pptx;
}

function _addSlidePro(pptx, titulo, data, tag, idx, tema) {
    const s        = pptx.addSlide();
    const bgHex    = _hexFromStyle(data?.style);
    const acHex    = _accentFromStyle(data?.style);
    const dkHex    = _darkFromStyle(data?.style);
    const { intro, puntos, detalle } = _parsearTexto(data?.texto || '');

    // Fondo suave
    s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:13.33, h:7.5, fill:{color:bgHex} });

    // Barra lateral izquierda de color
    s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:0.18, h:7.5, fill:{color:acHex} });

    // Cabecera: badge tag + título
    s.addShape(pptx.ShapeType.roundRect, {
        x:0.35, y:0.28, w:1.6, h:0.32,
        fill:{color:acHex}, rectRadius:0.06
    });
    s.addText(tag, {
        x:0.35, y:0.28, w:1.6, h:0.32,
        fontSize:8, bold:true, color:'ffffff',
        align:'center', valign:'middle', fontFace:'Calibri'
    });
    s.addText(titulo, {
        x:0.35, y:0.65, w:8.2, h:0.75,
        fontSize:18, bold:true, color:dkHex,
        fontFace:'Calibri', valign:'top'
    });

    // Separador
    s.addShape(pptx.ShapeType.rect, { x:0.35, y:1.45, w:8.2, h:0.03, fill:{color:acHex}, transparency:60 });

    // Texto intro
    if (intro) {
        s.addText(intro, {
            x:0.35, y:1.55, w:8.2, h:0.8,
            fontSize:11, color:'334155', fontFace:'Calibri',
            valign:'top', italic:true
        });
    }

    // Viñetas con estilo
    if (puntos.length) {
        const items = puntos.map(p => ({
            text: p.replace(/^•\s*/,''),
            options: { fontSize:10.5, color:'1e293b', fontFace:'Calibri', bullet:{code:'2022'}, paraSpaceAfter:4 }
        }));
        s.addText(items, {
            x:0.35, y:2.42, w:8.2, h:3.8,
            valign:'top', lineSpacing:18
        });
    }

    // Imagen a la derecha
    if (data?.img) {
        // Marco de imagen
        s.addShape(pptx.ShapeType.rect, {
            x:8.8, y:0.28, w:4.25, h:4.8,
            fill:{color:'ffffff'}, line:{color:acHex, width:1.5},
            shadow:{type:'outer', color:'64748b', blur:8, offset:3, angle:45, opacity:.15}
        });
        try {
            s.addImage({ path:data.img, x:8.82, y:0.3, w:4.21, h:4.76, sizing:{type:'cover'} });
        } catch(_) {}
    }

    // Texto detalle abajo (si existe)
    if (detalle) {
        s.addShape(pptx.ShapeType.rect, { x:0, y:6.3, w:13.33, h:1.2, fill:{color:dkHex}, transparency:90 });
        s.addText(detalle.substring(0, 220), {
            x:0.35, y:6.35, w:12.6, h:1.05,
            fontSize:9, color:'475569', fontFace:'Calibri',
            valign:'top', italic:true
        });
    }

    // Pie: número y nombre tema
    s.addText(`${idx + 1}  ·  ${datosCurriculares.tema}`, {
        x:0.35, y:7.22, w:8, h:0.25,
        fontSize:7.5, color:'94a3b8', fontFace:'Calibri'
    });
}

function _addSlideQuizPro(pptx, titulo, data, idx, tema) {
    const s = pptx.addSlide();

    // Fondo oscuro para el quiz
    s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:13.33, h:7.5, fill:{color:'0f172a'} });
    s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:13.33, h:0.06, fill:{color:tema.accent} });
    s.addShape(pptx.ShapeType.rect, { x:0, y:7.44, w:13.33, h:0.06, fill:{color:tema.accent} });

    // Badge
    s.addShape(pptx.ShapeType.roundRect, { x:0.5, y:0.3, w:1.6, h:0.32, fill:{color:tema.accent}, rectRadius:0.06 });
    s.addText('🧠 EVALUACIÓN', { x:0.5, y:0.3, w:1.6, h:0.32, fontSize:7.5, bold:true, color:'ffffff', align:'center', valign:'middle', fontFace:'Calibri' });

    // Título
    s.addText(titulo, { x:0.5, y:0.72, w:12.3, h:0.7, fontSize:17, bold:true, color:'f1f5f9', fontFace:'Calibri' });

    // Separador
    s.addShape(pptx.ShapeType.rect, { x:0.5, y:1.48, w:12.3, h:0.04, fill:{color:tema.accent}, transparency:50 });

    // Parsear pregunta y opciones
    const lineas  = (data?.texto||'').split('\n').filter(Boolean);
    const pregunta = lineas[0] || '';
    const opciones = lineas.slice(1);

    s.addText(pregunta, {
        x:0.5, y:1.6, w:12.3, h:1.0,
        fontSize:14, bold:true, color:'f8fafc', fontFace:'Calibri', valign:'top'
    });

    // Opciones con cajas
    const colores = [tema.accent, '06b6d4', '22c55e', 'f59e0b'];
    opciones.forEach((op, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const x   = 0.5 + col * 6.4;
        const y   = 2.75 + row * 1.55;
        s.addShape(pptx.ShapeType.roundRect, {
            x, y, w:6.1, h:1.3,
            fill:{color:colores[i]||tema.accent}, transparency:85,
            line:{color:colores[i]||tema.accent, width:1.2},
            rectRadius:0.12
        });
        s.addText(op, {
            x:x+0.15, y:y+0.08, w:5.8, h:1.14,
            fontSize:12, color:'f1f5f9', fontFace:'Calibri', valign:'middle', bold: i===0
        });
    });

    // Script/respuesta al pie
    if (data?.script) {
        s.addShape(pptx.ShapeType.rect, { x:0, y:6.4, w:13.33, h:1.1, fill:{color:'1e293b'} });
        s.addText('Respuesta · ' + data.script.substring(0, 180), {
            x:0.5, y:6.45, w:12.3, h:0.95,
            fontSize:8.5, color:'94a3b8', fontFace:'Calibri', valign:'middle', italic:true
        });
    }
}

function exportarClaseAPowerPoint(){
    construirPPTX().writeFile({fileName:`Presentacion_AprendIA_${datosCurriculares.tema.replace(/\s+/g,'_')}`});
    mostrarToast('📊 PowerPoint generando...');
}

// =========================================================================
//  EXPORTAR EXAMEN WORD
// =========================================================================
async function exportarExamenWord() {
    mostrarCargando("Diseñando examen con Gemini...");
    const prompt=`Diseña un examen formal de 10 preguntas para "${datosCurriculares.nivel}" sobre "${datosCurriculares.tema}".
BLOQUE 1 (6 prácticas): problemas o análisis.
BLOQUE 2 (4 teóricas): definición, relacionar, completar, opción múltiple con justificación.
Devuelve SOLO: {"practicas":["P1","P2","P3","P4","P5","P6"],"teoricas":["P7","P8","P9","P10"]}`;
    try {
        const ex=await llamarGemini(prompt, documentosReferencia.length>0);
        const html=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head><meta charset="UTF-8"><style>body{font-family:Calibri;padding:20px;line-height:1.4}
.t{width:100%;border:2px solid #1b365d;margin-bottom:25px;border-collapse:collapse}.t td{border:1px solid #1b365d;padding:8px;font-size:11pt}
.ti{text-align:center;color:#1b365d;font-size:18pt;font-weight:bold;text-transform:uppercase}
.st{font-size:13pt;font-weight:bold;color:white;background:#1b365d;padding:6px;margin-top:20px;text-transform:uppercase}
.q{font-size:11pt;margin-bottom:8px;font-weight:bold}.a{color:#94a3b8;font-size:11pt;margin-bottom:24px}
</style></head><body>
<div class="ti">Evaluación de Competencias</div>
<p style="text-align:center;font-style:italic;color:#475569">AprendIA · Gemini AI (Google)</p>
<table class="t">
<tr><td width="60%"><b>MATERIA:</b> ${datosCurriculares.tema}</td><td><b>FECHA:</b> ___________</td></tr>
<tr><td><b>ALUMNO/A:</b> ________________________________________________</td><td><b>NOTA:</b> /10</td></tr>
<tr><td><b>NIVEL:</b> ${datosCurriculares.nivel.toUpperCase()}</td><td><b>TIEMPO:</b> 60 min</td></tr>
</table>
<div class="st">Bloque I — Aplicación Práctica (6 puntos)</div>
${(ex.practicas||[]).map((q,i)=>`<div class="q">${i+1}. ${q}</div><div class="a">.........................................................................................................................................................................................................<br><br>.........................................................................................................................................................................................................<br><br>.........................................................................................................................................................................................................</div>`).join('')}
<div class="st">Bloque II — Fundamentos Teóricos (4 puntos)</div>
${(ex.teoricas||[]).map((q,i)=>`<div class="q">${i+7}. ${q}</div><div class="a">.........................................................................................................................................................................................................<br><br>.........................................................................................................................................................................................................</div>`).join('')}
</body></html>`;
        const blob=new Blob(['\ufeff'+html],{type:'application/msword'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url;
        a.download=`Examen_AprendIA_${datosCurriculares.tema.replace(/\s+/g,'_')}.doc`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        mostrarToast('📝 Examen Word descargando...');
        cambiarPantalla('screen-diapositivas'); renderizarDiapositivaActual();
    } catch(err){ mostrarToast('⚠️ '+err.message,'error'); cambiarPantalla('screen-diapositivas'); }
}

// =========================================================================
//  GOOGLE FORMS — EXPORTAR Y CORREGIR
// =========================================================================

function abrirModalForms() {
    document.getElementById('forms-output-wrap').style.display = 'none';
    document.getElementById('correccion-output').style.display = 'none';
    document.getElementById('modal-forms').style.display = 'flex';
}

function abrirFormsDesdeCarpeeta(tema) {
    cargarDatosCarpeta(tema);
    abrirModalForms();
}

async function generarFormsTexto() {
    const tipo = document.getElementById('forms-tipo').value;
    const btn  = document.getElementById('btn-forms-generar');
    btn.disabled = true;
    btn.textContent = '⏳ Generando preguntas...';
    mostrarToast('📋 Generando preguntas con IA...');

    let texto = '';
    texto += `FORMULARIO DE EVALUACIÓN — ${datosCurriculares.tema.toUpperCase()}
`;
    texto += `Nivel: ${datosCurriculares.nivel} · Generado con AprendIA
`;
    texto += '═'.repeat(60) + '

';
    texto += 'INSTRUCCIONES PARA EL ALUMNO:
';
    texto += `Nombre completo: ___________________________
`;
    texto += `Fecha: _______________

`;

    let numPregunta = 1;

    if (tipo === 'quiz' || tipo === 'ambos') {
        texto += '── BLOQUE I: QUIZ DE CLASE ──────────────────────────

';
        listaSubapartadosGlobal.forEach((item) => {
            const sub    = item.subapartado;
            const bloque = contenidoDiapositivas[sub];
            if (!bloque?.quiz?.texto) return;
            const lineas  = bloque.quiz.texto.split('
').filter(Boolean);
            const pregunta = lineas[0] || '';
            const opciones = lineas.slice(1);
            texto += `${numPregunta}. ${pregunta}
`;
            opciones.forEach(op => { texto += `   ${op}
`; });
            texto += '
';
            numPregunta++;
        });
    }

    if (tipo === 'examen' || tipo === 'ambos') {
        mostrarToast('⏳ Generando examen con IA...');
        const prompt = `Diseña un examen formal de 10 preguntas para "${datosCurriculares.nivel}" sobre "${datosCurriculares.tema}".
BLOQUE 1 (6 prácticas): problemas o análisis propios de la materia, numerados del 1 al 6.
BLOQUE 2 (4 teóricas): definición de términos, relacionar columnas, completar espacios, opción múltiple con justificación. Numeradas del 7 al 10.
Devuelve SOLO: {"practicas":["Enunciado completo 1","Enunciado 2","Enunciado 3","Enunciado 4","Enunciado 5","Enunciado 6"],"teoricas":["Enunciado 7","Enunciado 8","Enunciado 9","Enunciado 10"]}`;

        try {
            const ex = await llamarGemini(prompt);
            texto += '
── BLOQUE II: EXAMEN ESCRITO ────────────────────────

';
            texto += 'PARTE PRÁCTICA (6 puntos)

';
            (ex.practicas||[]).forEach((q,i) => {
                texto += `${numPregunta}. ${q}

Respuesta:
_______________________________________________
_______________________________________________
_______________________________________________

`;
                numPregunta++;
            });
            texto += 'PARTE TEÓRICA (4 puntos)

';
            (ex.teoricas||[]).forEach((q,i) => {
                texto += `${numPregunta}. ${q}

Respuesta:
_______________________________________________
_______________________________________________

`;
                numPregunta++;
            });
        } catch(e) {
            texto += '
[Error generando examen: ' + e.message + ']
';
        }
    }

    texto += '
' + '═'.repeat(60) + '
';
    texto += 'Generado con AprendIA · OpenRouter AI
';

    // Mostrar resultado
    const outWrap = document.getElementById('forms-output-wrap');
    const outText = document.getElementById('forms-output-text');
    outText.innerText = texto;
    outWrap.style.display = 'block';
    outWrap._formsTexto   = texto;

    btn.disabled    = false;
    btn.textContent = '📋 Regenerar';

    // Cambiar botón a "Corregir con IA" si hay URL de Sheet
    mostrarToast('✅ Preguntas generadas. Cópialas en Google Forms.');
}

function copiarFormsTexto() {
    const wrap = document.getElementById('forms-output-wrap');
    const txt  = wrap._formsTexto || document.getElementById('forms-output-text').innerText;
    navigator.clipboard.writeText(txt).then(() => mostrarToast('📋 Copiado al portapapeles.'));
}

function descargarFormsTxt() {
    const wrap = document.getElementById('forms-output-wrap');
    const txt  = wrap._formsTexto || document.getElementById('forms-output-text').innerText;
    const blob = new Blob([txt], { type:'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Formulario_${datosCurriculares.tema.replace(/\s+/g,'_')}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    mostrarToast('⬇ Formulario descargado.');
}

async function corregirRespuestasSheet() {
    const url = document.getElementById('forms-sheet-url').value.trim();
    if (!url) { mostrarToast('Introduce la URL del Google Sheet.','error'); return; }

    mostrarToast('🤖 Intentando leer el Sheet...');
    // Convertir URL de Sheet a URL de CSV exportable
    let csvUrl = url;
    if (url.includes('/edit')) csvUrl = url.replace('/edit#gid=', '/export?format=csv&gid=').replace('/edit', '/export?format=csv');
    else if (!url.includes('export')) csvUrl = url + '/export?format=csv';

    try {
        const r = await fetch(csvUrl);
        if (!r.ok) throw new Error('No se pudo leer el Sheet. Asegúrate de que sea público.');
        const csvText = await r.text();
        const lineas  = csvText.trim().split('
').slice(1); // saltar cabecera

        if (!lineas.length) { mostrarToast('El Sheet está vacío o no tiene respuestas.','error'); return; }

        mostrarToast(`Corrigiendo ${lineas.length} respuesta(s) con IA...`);

        // Clave de respuestas del quiz
        const claves = listaSubapartadosGlobal.map(item => {
            const b = contenidoDiapositivas[item.subapartado];
            return { sub: item.subapartado, clave: b?.quiz?.script || '' };
        });

        const prompt = `Eres corrector pedagógico. Tienes estas preguntas y claves de respuesta:
${JSON.stringify(claves.map((c,i) => ({pregunta: i+1, subapartado: c.sub, clave_respuesta: c.clave.substring(0,200)})))}

Tienes estas respuestas de alumnos (en formato CSV, cada fila es un alumno, columnas son: timestamp, nombre, respuesta1, respuesta2...):
${lineas.slice(0,10).join('
')}

Para cada alumno devuelve un objeto con:
- nombre
- nota_sobre_10
- comentario_general (1-2 frases motivadoras)
- correcciones: array con {pregunta, correcto, observacion} para cada respuesta

Devuelve SOLO array JSON con ${Math.min(lineas.length,10)} objetos.`;

        const resultados = await llamarGemini(prompt);
        mostrarResultadosCorreccion(resultados);
    } catch(e) {
        mostrarToast('Error: ' + e.message,'error');
    }
}

function mostrarResultadosCorreccion(resultados) {
    const wrap = document.getElementById('correccion-output');
    const cont = document.getElementById('correccion-resultados');
    wrap.style.display = 'block';
    cont.innerHTML = '';

    if (!Array.isArray(resultados)) {
        cont.innerHTML = '<p style="color:var(--fog)">No se pudieron procesar los resultados.</p>';
        return;
    }

    resultados.forEach(alumno => {
        const nota    = alumno.nota_sobre_10 || '?';
        const color   = nota >= 7 ? 'var(--em)' : nota >= 5 ? 'var(--amber)' : 'var(--rs)';
        const div     = document.createElement('div');
        div.className = 'corr-item';
        div.innerHTML = `
            <div class="corr-hdr">
                <span class="corr-name">${alumno.nombre || 'Alumno'}</span>
                <span class="corr-nota" style="color:${color}">${nota}/10</span>
            </div>
            <p class="corr-comment">${alumno.comentario_general || ''}</p>
            ${(alumno.correcciones||[]).map(c => `
                <div class="corr-preg ${c.correcto ? 'corr-ok' : 'corr-fail'}">
                    P${c.pregunta}: ${c.observacion||''}
                </div>`).join('')}`;
        cont.appendChild(div);
    });

    // Botón para descargar informe
    const btnDesc = document.createElement('button');
    btnDesc.className = 'btn btn-v';
    btnDesc.style.cssText = 'margin-top:10px;width:100%;font-size:.82rem;padding:10px';
    btnDesc.textContent = '⬇ Descargar Informe de Corrección';
    btnDesc.onclick = () => descargarInformeCorreccion(resultados);
    cont.appendChild(btnDesc);

    mostrarToast('✅ Corrección completada.');
}

function descargarInformeCorreccion(resultados) {
    let txt = `INFORME DE CORRECCIÓN — ${datosCurriculares.tema}
`;
    txt    += `Generado con AprendIA · ${new Date().toLocaleDateString('es-ES')}
`;
    txt    += '═'.repeat(50) + '

';
    resultados.forEach((a, i) => {
        txt += `${i+1}. ${a.nombre || 'Alumno'} — Nota: ${a.nota_sobre_10}/10
`;
        txt += `   ${a.comentario_general || ''}
`;
        (a.correcciones||[]).forEach(c => {
            txt += `   P${c.pregunta} [${c.correcto?'✓':'✗'}]: ${c.observacion}
`;
        });
        txt += '
';
    });
    const blob = new Blob([txt], { type:'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download=`Informe_Correccion_${datosCurriculares.tema.replace(/\s+/g,'_')}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}
