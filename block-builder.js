/**
 * Block Builder V2 — Modele JSON
 * L'etat du builder est un arbre JSON. Le canvas rend le modele.
 * Les configs modifient le modele, le canvas re-rend.
 * L'export genere du HTML propre depuis le modele.
 * Note: innerHTML usage is intentional for rendering trusted template content
 * from the builder's own model - no user-submitted HTML is rendered unsanitized.
 */
(function() {
  // ─── ID generator ───
  var _nextId = 1;
  function uid() { return 'bb' + (_nextId++); }

  // ─── Model ───
  var model = { id: uid(), type: 'root', props: {}, children: [] };
  var selectedId = null;
  var editSourceIdx = null; // index du bloc editeur en mode edition

  function createNode(type, props, children) {
    return { id: uid(), type: type, props: props || {}, children: children || [] };
  }

  function findNode(node, id) {
    if (node.id === id) return node;
    for (var i = 0; i < (node.children || []).length; i++) {
      var found = findNode(node.children[i], id);
      if (found) return found;
    }
    return null;
  }

  function findParent(node, id) {
    for (var i = 0; i < (node.children || []).length; i++) {
      if (node.children[i].id === id) return { parent: node, index: i };
      var found = findParent(node.children[i], id);
      if (found) return found;
    }
    return null;
  }

  function removeNode(id) {
    var info = findParent(model, id);
    if (info) info.parent.children.splice(info.index, 1);
  }

  function addChild(parentId, child, atIndex) {
    var parent = findNode(model, parentId);
    if (!parent) return;
    if (!parent.children) parent.children = [];
    if (atIndex !== undefined) parent.children.splice(atIndex, 0, child);
    else parent.children.push(child);
  }

  function moveNode(id, delta) {
    var info = findParent(model, id);
    if (!info) return;
    var newIdx = info.index + delta;
    if (newIdx < 0 || newIdx >= info.parent.children.length) return;
    var arr = info.parent.children;
    var tmp = arr[info.index];
    arr[info.index] = arr[newIdx];
    arr[newIdx] = tmp;
  }

  // ─── Elements palette ───
  var ELEMENTS = [
    { id: 'h2', label: 'H2', ico: 'H' },
    { id: 'h3', label: 'H3', ico: 'h' },
    { id: 'p', label: 'Texte', ico: '\u00b6' },
    { id: 'img', label: 'Image', ico: '\ud83d\uddbc' },
    { id: 'btn', label: 'Bouton', ico: '\u25a2' },
    { id: 'widget', label: 'Lien int.', ico: '\ud83d\udd17' },
    { id: 'hr', label: 'Separateur', ico: '\u2500' },
    { id: 'badge', label: 'Pastille', ico: '\u2460' },
    { id: 'stat', label: 'Chiffre', ico: '#' },
    { id: 'span', label: 'Label', ico: 'T' },
    { id: 'icon', label: 'Icone', ico: '\u2605' },
    { id: 'aside', label: 'Encadre', ico: '\u25a1' },
    { id: 'group', label: 'Groupe', ico: '\u2194' }
  ];

  var LAYOUTS = [
    { id: '1col', label: '1 colonne', cols: [12] },
    { id: '2col-equal', label: '2 col (50/50)', cols: [6, 6] },
    { id: '2col-left', label: '2 col (33/66)', cols: [4, 8] },
    { id: '2col-right', label: '2 col (66/33)', cols: [8, 4] },
    { id: '3col', label: '3 colonnes', cols: [4, 4, 4] },
    { id: 'flex', label: 'Flex horizontal', cols: [] }
  ];

  var WS_COLORS = [
    { label: 'Primary', hex: '#0061E2' },
    { label: 'Dark blue', hex: '#084298' },
    { label: 'Navy', hex: '#052c65' },
    { label: 'Purple', hex: '#5a32a3' },
    { label: 'Green', hex: '#198754' },
    { label: 'Orange', hex: '#e65100' },
    { label: 'Gold', hex: '#E7B25C' },
    { label: 'Light', hex: '#f8f9fa' },
    { label: 'Border', hex: '#dee2e6' },
    { label: 'Dark', hex: '#212529' },
    { label: 'BG light', hex: '#F8F9FC' },
    { label: 'BG blue', hex: '#e7effb' }
  ];

  var ICONS = ['package','shield-check','truck','handshake','headset','lightning','check','mail','clipboard-list','search','tools','gift','timer','rss','arrow-up-right'];

  // ─── Default props per type ───
  function defaultProps(type) {
    switch (type) {
      case 'h2': return { text: 'Titre de section', className: 'ws-h2' };
      case 'h3': return { text: 'Sous-titre', className: 'ws-h3' };
      case 'p': return { text: 'Votre texte ici.', className: 'ws-text' };
      case 'img': return { src: '', alt: 'Description', className: 'w-100 rounded-3' };
      case 'btn': return { text: 'Bouton', href: '#', className: 'btn btn-primary', padding: '1.2rem 2.8rem', radius: '8px' };
      case 'widget': return { text: 'lien interne', idPath: 'category/ID' };
      case 'hr': return { color: '#e5e5e5', margin: '1.6rem 0' };
      case 'badge': return { value: '1', bg: 'var(--bs-primary)', shape: 'num' };
      case 'stat': return { value: '42', color: 'var(--bs-primary)' };
      case 'span': return { text: 'Label texte', className: 'ws-bloc-title' };
      case 'icon': return { name: 'package', bg: 'primary', size: '24' };
      case 'aside': return { title: 'Titre', text: 'Contenu.', borderColor: 'var(--bs-primary)' };
      case 'group': return { gap: '8px', align: 'center', wrap: true };
      case 'row': return { gap: 'g-4' };
      case 'col': return { size: 6 };
      default: return {};
    }
  }

  // ─── Render Canvas ───
  function renderCanvas() {
    var canvas = document.getElementById('bbCanvas');
    if (!canvas) return;
    canvas.textContent = '';

    if (model.children.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'bb-empty-state';
      empty.textContent = 'Choisissez un layout ou glissez des elements ici';
      canvas.appendChild(empty);
      setupCanvasDrop(canvas);
      renderConfig();
      return;
    }

    model.children.forEach(function(child) {
      canvas.appendChild(renderNode(child));
    });
    setupCanvasDrop(canvas);
  }

  function renderNode(node) {
    var el;
    switch (node.type) {
      case 'row': el = renderRow(node); break;
      case 'col': el = renderCol(node); break;
      case 'group': el = renderGroup(node); break;
      case 'h2': el = renderHeading(node, 'h2'); break;
      case 'h3': el = renderHeading(node, 'h3'); break;
      case 'p': el = renderParagraph(node); break;
      case 'img': el = renderImage(node); break;
      case 'btn': el = renderButton(node); break;
      case 'widget': el = renderWidget(node); break;
      case 'hr': el = renderHr(node); break;
      case 'badge': el = renderBadge(node); break;
      case 'stat': el = renderStat(node); break;
      case 'span': el = renderSpan(node); break;
      case 'icon': el = renderIcon(node); break;
      case 'aside': el = renderAside(node); break;
      default: el = document.createElement('div'); el.textContent = '[' + node.type + ']';
    }

    // Wrapper bb-el
    var wrapper = document.createElement('div');
    wrapper.className = 'bb-el' + (selectedId === node.id ? ' selected' : '');
    wrapper.dataset.nodeId = node.id;

    var label = document.createElement('span');
    label.className = 'bb-el-label';
    label.textContent = (ELEMENTS.find(function(e) { return e.id === node.type; }) || { label: node.type }).label;
    wrapper.appendChild(label);

    var removeBtn = document.createElement('button');
    removeBtn.className = 'bb-el-remove';
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (selectedId === node.id) selectedId = null;
      removeNode(node.id);
      renderCanvas();
    });
    wrapper.appendChild(removeBtn);

    wrapper.appendChild(el);
    wrapper.addEventListener('click', function(e) {
      e.stopPropagation();
      selectedId = node.id;
      renderCanvas();
    });

    // Containers accept drops
    if (node.type === 'row' || node.type === 'col' || node.type === 'group') {
      // drop already handled inside renderRow/renderCol/renderGroup
    }

    // Apply container styles from props
    applyContainerStyles(wrapper, node.props);

    return wrapper;
  }

  function applyContainerStyles(el, props) {
    if (props.padding) el.style.padding = props.padding;
    if (props.background) el.style.background = props.background;
    if (props.color) el.style.color = props.color;
    if (props.borderRadius) el.style.borderRadius = props.borderRadius;
    if (props.justifyContent) { el.style.display = 'flex'; el.style.justifyContent = props.justifyContent; }
    if (props.alignItems) { el.style.display = 'flex'; el.style.alignItems = props.alignItems; }
  }

  function renderRow(node) {
    var row = document.createElement('div');
    row.className = 'bb-row';
    row.style.gap = node.props.gap === 'g-0' ? '0' : '12px';
    node.children.forEach(function(child) {
      row.appendChild(renderNode(child));
    });
    return row;
  }

  function renderCol(node) {
    var col = document.createElement('div');
    col.className = 'bb-col';
    col.style.flex = node.props.size || 6;
    col.style.minHeight = '60px';
    node.children.forEach(function(child) {
      col.appendChild(renderNode(child));
    });
    setupElementDrop(col, node.id);
    return col;
  }

  function renderGroup(node) {
    var g = document.createElement('div');
    g.className = 'd-inline-flex align-items-' + (node.props.align || 'center');
    g.style.gap = node.props.gap || '8px';
    if (node.props.wrap) g.style.flexWrap = 'wrap';
    g.style.minHeight = '40px';
    g.style.minWidth = '80px';
    g.style.border = '1px dashed var(--border)';
    g.style.borderRadius = '6px';
    g.style.padding = '4px 8px';
    node.children.forEach(function(child) {
      g.appendChild(renderNode(child));
    });
    setupElementDrop(g, node.id);
    return g;
  }

  function renderHeading(node, tag) {
    var h = document.createElement(tag);
    h.className = node.props.className || '';
    h.textContent = node.props.text || '';
    h.contentEditable = 'true';
    h.addEventListener('input', function() { node.props.text = h.textContent; });
    h.addEventListener('click', function(e) { e.stopPropagation(); });
    return h;
  }

  function renderParagraph(node) {
    var p = document.createElement('p');
    p.className = node.props.className || 'ws-text';
    p.textContent = node.props.text || '';
    p.contentEditable = 'true';
    p.addEventListener('input', function() { node.props.text = p.textContent; });
    p.addEventListener('click', function(e) { e.stopPropagation(); });
    return p;
  }

  function renderImage(node) {
    var wrap = document.createElement('div');
    var img = document.createElement('img');
    img.className = node.props.className || 'w-100 rounded-3';
    img.loading = 'lazy';
    img.decoding = 'async';
    if (node.props.src) {
      img.src = node.props.src;
      img.alt = node.props.alt || '';
    } else {
      wrap.style.cssText = 'min-height:80px;border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer';
      var ph = document.createElement('span');
      ph.textContent = '\ud83d\udcf7 Drop ou clic';
      ph.style.cssText = 'font-size:11px;color:var(--gray)';
      wrap.appendChild(ph);
    }
    wrap.appendChild(img);

    // Image drop
    wrap.addEventListener('dragover', function(e) { e.preventDefault(); wrap.style.borderColor = 'var(--pr)'; });
    wrap.addEventListener('dragleave', function() { wrap.style.borderColor = 'var(--border)'; });
    wrap.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      wrap.style.borderColor = 'var(--border)';
      var url = e.dataTransfer.getData('application/x-media-url') || e.dataTransfer.getData('text/plain');
      if (url && url.startsWith('http')) {
        node.props.src = url;
        node.props.alt = url.split('/').pop().replace(/\.[^.]+$/, '').replace(/-/g, ' ');
        renderCanvas();
      }
    });
    wrap.addEventListener('click', function(e) {
      if (e.target === img || e.target === ph || e.target === wrap) {
        e.stopPropagation();
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function() {
          if (!input.files[0]) return;
          var token = typeof getToken === 'function' ? getToken() : null;
          if (!token) { toast('Token requis'); return; }
          var formData = new FormData();
          formData.append('image', input.files[0]);
          fetch(typeof getMediaApiUrl === 'function' ? getMediaApiUrl() : '', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
          }).then(function(r) { return r.json(); }).then(function(data) {
            node.props.src = data.url;
            node.props.alt = data.filename.replace(/\.[^.]+$/, '').replace(/-/g, ' ');
            renderCanvas();
          });
        };
        input.click();
      }
    });
    return wrap;
  }

  function renderButton(node) {
    var a = document.createElement('a');
    a.href = '#';
    a.className = node.props.className || 'btn btn-primary';
    a.textContent = node.props.text || 'Bouton';
    a.style.padding = node.props.padding || '1.2rem 2.8rem';
    a.style.borderRadius = node.props.radius || '8px';
    a.contentEditable = 'true';
    a.addEventListener('input', function() { node.props.text = a.textContent; });
    a.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); });
    return a;
  }

  function renderWidget(node) {
    var s = document.createElement('span');
    s.className = 'widget-link';
    s.title = node.props.idPath || '';
    s.textContent = node.props.text || 'lien interne';
    s.contentEditable = 'true';
    s.addEventListener('input', function() { node.props.text = s.textContent; });
    s.addEventListener('click', function(e) { e.stopPropagation(); });
    return s;
  }

  function renderHr(node) {
    var hr = document.createElement('hr');
    hr.style.border = 'none';
    hr.style.borderTop = '1px solid ' + (node.props.color || '#e5e5e5');
    hr.style.margin = node.props.margin || '1.6rem 0';
    return hr;
  }

  function renderBadge(node) {
    var d = document.createElement('div');
    d.className = node.props.shape === 'round' ? 'ws-badge-round' : 'ws-badge-num';
    d.style.background = node.props.bg || 'var(--bs-primary)';
    d.textContent = node.props.value || '1';
    d.contentEditable = 'true';
    d.addEventListener('input', function() { node.props.value = d.textContent; });
    d.addEventListener('click', function(e) { e.stopPropagation(); });
    return d;
  }

  function renderStat(node) {
    var d = document.createElement('div');
    d.className = 'ws-stat-number';
    d.style.color = node.props.color || 'var(--bs-primary)';
    d.textContent = node.props.value || '42';
    d.contentEditable = 'true';
    d.addEventListener('input', function() { node.props.value = d.textContent; });
    d.addEventListener('click', function(e) { e.stopPropagation(); });
    return d;
  }

  function renderSpan(node) {
    var s = document.createElement('span');
    s.className = node.props.className || 'ws-bloc-title';
    s.textContent = node.props.text || 'Label texte';
    s.contentEditable = 'true';
    s.addEventListener('input', function() { node.props.text = s.textContent; });
    s.addEventListener('click', function(e) { e.stopPropagation(); });
    return s;
  }

  function renderIcon(node) {
    var outer = document.createElement('span');
    outer.className = 'd-inline-flex ws-ico-bg-lg bg-' + (node.props.bg || 'primary') + ' bg-opacity-10 rounded-4';
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ws-ico');
    svg.setAttribute('width', node.props.size || '24');
    svg.setAttribute('height', node.props.size || '24');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '/svg/_sprite-wynstor.svg#' + (node.props.name || 'package'));
    svg.appendChild(use);
    outer.appendChild(svg);
    return outer;
  }

  function renderAside(node) {
    var aside = document.createElement('aside');
    aside.className = 'ws-bg-light rounded-3 ws-p';
    aside.style.borderLeft = '4px solid ' + (node.props.borderColor || 'var(--bs-primary)');
    var title = document.createElement('div');
    title.className = 'ws-bloc-title';
    title.textContent = node.props.title || 'Titre';
    title.contentEditable = 'true';
    title.addEventListener('input', function() { node.props.title = title.textContent; });
    title.addEventListener('click', function(e) { e.stopPropagation(); });
    var p = document.createElement('p');
    p.className = 'ws-text-sm mb-0';
    p.textContent = node.props.text || 'Contenu.';
    p.contentEditable = 'true';
    p.addEventListener('input', function() { node.props.text = p.textContent; });
    p.addEventListener('click', function(e) { e.stopPropagation(); });
    aside.appendChild(title);
    aside.appendChild(p);
    return aside;
  }

  // ─── Drop handling ───
  function setupCanvasDrop(canvas) {
    canvas.addEventListener('dragover', function(e) { e.preventDefault(); });
    canvas.addEventListener('drop', function(e) {
      e.preventDefault();
      var elId = e.dataTransfer.getData('text/plain');
      if (elId && ELEMENTS.find(function(el) { return el.id === elId; })) {
        // Add to first available col, or root
        var target = findFirstCol(model);
        if (target) addChild(target, createNode(elId, defaultProps(elId)));
        else model.children.push(createNode(elId, defaultProps(elId)));
        renderCanvas();
      }
    });
  }

  function setupElementDrop(domEl, nodeId) {
    domEl.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
      domEl.classList.add('dragover');
    });
    domEl.addEventListener('dragleave', function() { domEl.classList.remove('dragover'); });
    domEl.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      domEl.classList.remove('dragover');
      var elId = e.dataTransfer.getData('text/plain');
      if (elId && ELEMENTS.find(function(el) { return el.id === elId; })) {
        addChild(nodeId, createNode(elId, defaultProps(elId)));
        renderCanvas();
      }
    });
  }

  function findFirstCol(node) {
    if (node.type === 'col') return node.id;
    for (var i = 0; i < (node.children || []).length; i++) {
      var found = findFirstCol(node.children[i]);
      if (found) return found;
    }
    return null;
  }

  // ─── Palette ───
  function renderPalette() {
    var grid = document.getElementById('bbPaletteGrid');
    if (!grid) return;
    grid.textContent = '';
    ELEMENTS.forEach(function(el) {
      var item = document.createElement('div');
      item.className = 'bb-palette-item';
      item.draggable = true;
      item.dataset.elId = el.id;
      var ico = document.createElement('span');
      ico.className = 'bb-ico';
      ico.textContent = el.ico;
      var lbl = document.createElement('span');
      lbl.textContent = el.label;
      item.appendChild(ico);
      item.appendChild(lbl);
      item.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', el.id);
        e.dataTransfer.effectAllowed = 'copy';
      });
      item.addEventListener('dblclick', function() {
        var target = findFirstCol(model);
        if (target) addChild(target, createNode(el.id, defaultProps(el.id)));
        else model.children.push(createNode(el.id, defaultProps(el.id)));
        renderCanvas();
      });
      grid.appendChild(item);
    });

    var layoutGrid = document.getElementById('bbLayoutGrid');
    if (!layoutGrid) return;
    layoutGrid.textContent = '';
    LAYOUTS.forEach(function(layout) {
      var item = document.createElement('div');
      item.className = 'bb-layout-item';
      var preview = document.createElement('div');
      preview.className = 'bb-layout-preview';
      if (layout.cols.length === 0) {
        for (var f = 0; f < 4; f++) preview.appendChild(document.createElement('div'));
      } else {
        layout.cols.forEach(function(c) {
          var d = document.createElement('div');
          d.style.flex = c;
          preview.appendChild(d);
        });
      }
      var lbl = document.createElement('span');
      lbl.textContent = layout.label;
      lbl.style.fontSize = '10px';
      item.appendChild(preview);
      item.appendChild(lbl);
      item.addEventListener('click', function() { addLayout(layout); });
      layoutGrid.appendChild(item);
    });
  }

  function addLayout(layout) {
    if (layout.cols.length === 0) {
      // Flex row
      model.children.push(createNode('group', { gap: '12px', align: 'center', wrap: true }));
    } else {
      var cols = layout.cols.map(function(c) {
        return createNode('col', { size: c });
      });
      model.children.push(createNode('row', { gap: 'g-4' }, cols));
    }
    renderCanvas();
  }

  function addElementToCanvas(elId) {
    var target = findFirstCol(model);
    if (target) addChild(target, createNode(elId, defaultProps(elId)));
    else model.children.push(createNode(elId, defaultProps(elId)));
    renderCanvas();
  }

  // ─── Config Panel ───
  function renderConfig() {
    var body = document.getElementById('bbConfigBody');
    if (!body) return;
    body.textContent = '';

    if (!selectedId) {
      body.innerHTML = '<div style="font-size:11px;color:var(--gray);padding:8px">Cliquez sur un element pour le configurer</div>';
      return;
    }

    var node = findNode(model, selectedId);
    if (!node) return;

    // Container props for all types
    addSection(body, 'Padding', makePresetBtns(
      [{ l: 'S', v: '8px 12px' }, { l: 'M', v: '16px 20px' }, { l: 'L', v: '24px 32px' }, { l: 'XL', v: '40px 48px' }, { l: '0', v: '0' }],
      function(v) { node.props.padding = v; renderCanvas(); }
    ));
    addSection(body, 'Fond', makePresetBtns(
      [{ l: 'Aucun', v: '' }, { l: 'Clair', v: 'var(--bs-light)' }, { l: 'Sombre', v: 'var(--bs-dark)' }, { l: 'Gradient', v: 'linear-gradient(90deg,var(--ws-purple-800),var(--ws-blue-550))' }],
      function(v) {
        node.props.background = v;
        node.props.color = (v.indexOf('dark') !== -1 || v.indexOf('gradient') !== -1) ? '#fff' : '';
        renderCanvas();
      }
    ));
    addSection(body, 'Couleur WS', makeColorDots(function(hex) {
      node.props.background = hex;
      var dark = ['#0061E2','#084298','#052c65','#5a32a3','#212529'];
      node.props.color = dark.indexOf(hex) !== -1 ? '#fff' : '';
      renderCanvas();
    }));
    addSection(body, 'Radius', makePresetBtns(
      [{ l: '0', v: '0' }, { l: 'S', v: '6px' }, { l: 'M', v: '12px' }, { l: 'L', v: '16px' }],
      function(v) { node.props.borderRadius = v; renderCanvas(); }
    ));
    addSection(body, 'Align H', makePresetBtns(
      [{ l: 'Gauche', v: 'flex-start' }, { l: 'Centre', v: 'center' }, { l: 'Droite', v: 'flex-end' }, { l: 'Space', v: 'space-between' }],
      function(v) { node.props.justifyContent = v; renderCanvas(); }
    ));
    addSection(body, 'Align V', makePresetBtns(
      [{ l: 'Haut', v: 'flex-start' }, { l: 'Centre', v: 'center' }, { l: 'Bas', v: 'flex-end' }, { l: 'Stretch', v: 'stretch' }],
      function(v) { node.props.alignItems = v; renderCanvas(); }
    ));

    // Gap for row/group
    if (node.type === 'row' || node.type === 'group' || node.type === 'col') {
      addSection(body, 'Gap', makePresetBtns(
        [{ l: '0', v: '0' }, { l: 'S', v: '8px' }, { l: 'M', v: '16px' }, { l: 'L', v: '24px' }],
        function(v) { node.props.gap = v; renderCanvas(); }
      ));
    }

    // Type-specific controls
    if (node.type === 'h2' || node.type === 'h3') {
      addSection(body, 'Texte titre', makeInput(node.props.text || '', function(v) { node.props.text = v; renderCanvas(); }));
    }
    if (node.type === 'p') {
      addSection(body, 'Texte', makeInput(node.props.text || '', function(v) { node.props.text = v; renderCanvas(); }));
    }
    if (node.type === 'span') {
      addSection(body, 'Label', makeInput(node.props.text || '', function(v) { node.props.text = v; renderCanvas(); }));
    }
    if (node.type === 'btn') {
      addSection(body, 'Bouton', makeControlGroup([
        makeInputRow('Texte', node.props.text || '', function(v) { node.props.text = v; renderCanvas(); }),
        makeInputRow('Lien', node.props.href || '#', function(v) { node.props.href = v; }),
        makePresetBtns(
          [{ l: 'Primary', v: 'btn btn-primary' }, { l: 'Light', v: 'btn btn-light' }, { l: 'Dark', v: 'btn btn-dark' }, { l: 'Outline', v: 'btn btn-outline-primary' }],
          function(v) { node.props.className = v; renderCanvas(); }
        )
      ]));
    }
    if (node.type === 'img') {
      addSection(body, 'Image', makeControlGroup([
        makeInputRow('Alt', node.props.alt || '', function(v) { node.props.alt = v; }),
        makeInputRow('Src', node.props.src || '', function(v) { node.props.src = v; renderCanvas(); })
      ]));
    }
    if (node.type === 'widget') {
      addSection(body, 'Lien interne', makeControlGroup([
        makeInputRow('Texte', node.props.text || '', function(v) { node.props.text = v; renderCanvas(); }),
        makeInputRow('ID path', node.props.idPath || '', function(v) { node.props.idPath = v; })
      ]));
    }
    if (node.type === 'badge') {
      addSection(body, 'Pastille', makeControlGroup([
        makeInputRow('Valeur', node.props.value || '', function(v) { node.props.value = v; renderCanvas(); }),
        makePresetBtns(
          [{ l: 'Rond', v: 'round' }, { l: 'Num', v: 'num' }],
          function(v) { node.props.shape = v; renderCanvas(); }
        ),
        makeColorDots(function(hex) { node.props.bg = hex; renderCanvas(); })
      ]));
    }
    if (node.type === 'stat') {
      addSection(body, 'Chiffre', makeControlGroup([
        makeInputRow('Valeur', node.props.value || '', function(v) { node.props.value = v; renderCanvas(); }),
        makeColorDots(function(hex) { node.props.color = hex; renderCanvas(); })
      ]));
    }
    if (node.type === 'icon') {
      addSection(body, 'Icone', makeIconPicker(function(name) { node.props.name = name; renderCanvas(); }));
    }
    if (node.type === 'aside') {
      addSection(body, 'Encadre', makeControlGroup([
        makeInputRow('Titre', node.props.title || '', function(v) { node.props.title = v; renderCanvas(); }),
        makeInputRow('Texte', node.props.text || '', function(v) { node.props.text = v; renderCanvas(); }),
        makeColorDots(function(hex) { node.props.borderColor = hex; renderCanvas(); })
      ]));
    }
    if (node.type === 'hr') {
      addSection(body, 'Separateur', makeColorDots(function(hex) { node.props.color = hex; renderCanvas(); }));
    }
    if (node.type === 'col') {
      addSection(body, 'Taille colonne', makePresetBtns(
        [{ l: '3', v: 3 }, { l: '4', v: 4 }, { l: '6', v: 6 }, { l: '8', v: 8 }, { l: '9', v: 9 }, { l: '12', v: 12 }],
        function(v) { node.props.size = v; renderCanvas(); }
      ));
    }
  }

  // ─── Config helpers ───
  function addSection(body, title, content) {
    var section = document.createElement('div');
    section.style.cssText = 'margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)';
    var lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--gray);margin-bottom:6px';
    lbl.textContent = title;
    section.appendChild(lbl);
    if (Array.isArray(content)) content.forEach(function(c) { if (c) section.appendChild(c); });
    else if (content) section.appendChild(content);
    body.appendChild(section);
  }

  function makePresetBtns(presets, onClick) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap';
    presets.forEach(function(p) {
      var btn = document.createElement('button');
      btn.style.cssText = 'padding:3px 8px;border-radius:4px;font-size:10px;cursor:pointer;border:1px solid var(--border);background:var(--card);color:var(--gray);transition:all .15s';
      btn.textContent = p.l;
      btn.onmouseenter = function() { btn.style.borderColor = 'var(--pr)'; };
      btn.onmouseleave = function() { btn.style.borderColor = 'var(--border)'; };
      btn.onclick = function() { onClick(p.v); };
      wrap.appendChild(btn);
    });
    return wrap;
  }

  function makeColorDots(onClick) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:3px;flex-wrap:wrap';
    WS_COLORS.forEach(function(c) {
      var dot = document.createElement('div');
      dot.style.cssText = 'width:18px;height:18px;border-radius:3px;cursor:pointer;border:2px solid transparent;background:' + c.hex;
      dot.title = c.label + ' (' + c.hex + ')';
      dot.onmouseenter = function() { dot.style.borderColor = '#666'; };
      dot.onmouseleave = function() { dot.style.borderColor = 'transparent'; };
      dot.onclick = function() { onClick(c.hex); };
      wrap.appendChild(dot);
    });
    return wrap;
  }

  function makeInput(value, onChange) {
    var input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.style.cssText = 'width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:11px';
    input.addEventListener('input', function() { onChange(input.value); });
    return input;
  }

  function makeInputRow(label, value, onChange) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px';
    var lbl = document.createElement('label');
    lbl.style.cssText = 'min-width:40px;font-size:10px;color:var(--gray)';
    lbl.textContent = label;
    var input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.style.cssText = 'flex:1;padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:11px';
    input.addEventListener('input', function() { onChange(input.value); });
    row.appendChild(lbl);
    row.appendChild(input);
    return row;
  }

  function makeControlGroup(controls) {
    var wrap = document.createElement('div');
    controls.forEach(function(c) { if (c) wrap.appendChild(c); });
    return wrap;
  }

  function makeIconPicker(onClick) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap';
    ICONS.forEach(function(name) {
      var btn = document.createElement('button');
      btn.style.cssText = 'padding:4px 6px;border-radius:4px;font-size:9px;cursor:pointer;border:1px solid var(--border);background:var(--card)';
      btn.textContent = name;
      btn.onclick = function() { onClick(name); };
      wrap.appendChild(btn);
    });
    return wrap;
  }

  // ─── Export HTML ───
  function exportHtml() {
    var parts = [];
    model.children.forEach(function(child) {
      parts.push(exportNode(child));
    });
    return parts.join('\n');
  }

  function exportNode(node) {
    var style = buildStyleStr(node);
    switch (node.type) {
      case 'row': {
        var gap = node.props.gap || 'g-4';
        var inner = node.children.map(function(c) { return exportNode(c); }).join('\n');
        return '<div class="row ' + gap + '"' + style + '>\n' + inner + '\n</div>';
      }
      case 'col': {
        var colClass = 'col-12 col-md-' + (node.props.size || 6);
        var inner = node.children.map(function(c) { return exportNode(c); }).join('\n');
        return '<div class="' + colClass + '"' + style + '>\n' + inner + '\n</div>';
      }
      case 'group': {
        var cls = 'd-inline-flex align-items-' + (node.props.align || 'center');
        if (node.props.wrap) cls += ' flex-wrap';
        var gapStyle = node.props.gap ? 'gap:' + node.props.gap : '';
        var s = gapStyle ? ' style="' + gapStyle + '"' : '';
        var inner = node.children.map(function(c) { return exportNode(c); }).join('\n');
        return '<div class="' + cls + '"' + s + style + '>\n' + inner + '\n</div>';
      }
      case 'h2': return '<h2 class="' + (node.props.className || 'ws-h2') + '"' + style + '>' + esc(node.props.text) + '</h2>';
      case 'h3': return '<h3 class="' + (node.props.className || 'ws-h3') + '"' + style + '>' + esc(node.props.text) + '</h3>';
      case 'p': return '<p class="' + (node.props.className || 'ws-text') + '"' + style + '>' + esc(node.props.text) + '</p>';
      case 'img': {
        var src = node.props.src || '';
        var alt = node.props.alt || '';
        return '<figure><img src="' + esc(src) + '" alt="' + esc(alt) + '" class="' + (node.props.className || 'w-100 rounded-3') + '" loading="lazy" decoding="async"><figcaption>' + esc(alt) + '</figcaption></figure>';
      }
      case 'btn': return '<a href="' + esc(node.props.href || '#') + '" class="' + (node.props.className || 'btn btn-primary') + '" style="padding:' + (node.props.padding || '1.2rem 2.8rem') + ';border-radius:' + (node.props.radius || '8px') + '">' + esc(node.props.text) + '</a>';
      case 'widget': return '<span class="widget-link" title="' + esc(node.props.idPath || '') + '">' + esc(node.props.text) + '</span>';
      case 'hr': return '<hr style="border:none;border-top:1px solid ' + (node.props.color || '#e5e5e5') + ';margin:' + (node.props.margin || '1.6rem 0') + '">';
      case 'badge': return '<div class="' + (node.props.shape === 'round' ? 'ws-badge-round' : 'ws-badge-num') + '" style="background:' + (node.props.bg || 'var(--bs-primary)') + '">' + esc(node.props.value) + '</div>';
      case 'stat': return '<div class="ws-stat-number" style="color:' + (node.props.color || 'var(--bs-primary)') + '">' + esc(node.props.value) + '</div>';
      case 'span': return '<span class="' + (node.props.className || 'ws-bloc-title') + '"' + style + '>' + esc(node.props.text) + '</span>';
      case 'icon': return '<span class="d-inline-flex ws-ico-bg-lg bg-' + (node.props.bg || 'primary') + ' bg-opacity-10 rounded-4"><svg class="ws-ico" width="' + (node.props.size || '24') + '" height="' + (node.props.size || '24') + '" fill="currentColor" aria-hidden="true"><use href="/svg/_sprite-wynstor.svg#' + (node.props.name || 'package') + '"></use></svg></span>';
      case 'aside': return '<aside class="ws-bg-light rounded-3 ws-p" style="border-left:4px solid ' + (node.props.borderColor || 'var(--bs-primary)') + '"><div class="ws-bloc-title">' + esc(node.props.title) + '</div><p class="ws-text-sm mb-0">' + esc(node.props.text) + '</p></aside>';
      default: return '<!-- unknown: ' + node.type + ' -->';
    }
  }

  function buildStyleStr(node) {
    var parts = [];
    if (node.props.padding) parts.push('padding:' + node.props.padding);
    if (node.props.background) parts.push('background:' + node.props.background);
    if (node.props.color) parts.push('color:' + node.props.color);
    if (node.props.borderRadius) parts.push('border-radius:' + node.props.borderRadius);
    if (node.props.justifyContent) parts.push('display:flex;justify-content:' + node.props.justifyContent);
    if (node.props.alignItems && node.type !== 'group') parts.push('align-items:' + node.props.alignItems);
    if (parts.length === 0) return '';
    return ' style="' + parts.join(';') + '"';
  }

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ─── Import HTML ───
  function importHtml(html) {
    var container = document.createElement('div');
    container.innerHTML = html;
    model = { id: uid(), type: 'root', props: {}, children: [] };
    Array.from(container.children).forEach(function(child) {
      var node = parseElement(child);
      if (node) model.children.push(node);
    });
    renderCanvas();
  }

  function parseElement(el) {
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (!tag) return null;

    // Row
    if (tag === 'div' && el.classList.contains('row')) {
      var cols = [];
      Array.from(el.children).forEach(function(child) {
        if (child.className && child.className.match(/col-/)) {
          var sizeMatch = child.className.match(/col-md-(\d+)/);
          var size = sizeMatch ? parseInt(sizeMatch[1]) : 6;
          var colNode = createNode('col', { size: size });
          Array.from(child.children).forEach(function(gc) {
            var n = parseElement(gc);
            if (n) colNode.children.push(n);
          });
          cols.push(colNode);
        } else {
          var n = parseElement(child);
          if (n) cols.push(n);
        }
      });
      var gapMatch = el.className.match(/g-(\d)/);
      return createNode('row', { gap: gapMatch ? 'g-' + gapMatch[1] : 'g-4' }, cols);
    }

    // Flex group
    if (tag === 'div' && el.classList.contains('d-inline-flex')) {
      var children = [];
      Array.from(el.children).forEach(function(c) { var n = parseElement(c); if (n) children.push(n); });
      return createNode('group', { gap: el.style.gap || '8px', align: 'center', wrap: el.classList.contains('flex-wrap') }, children);
    }

    // Headings
    if (tag === 'h2') return createNode('h2', { text: el.textContent.trim(), className: el.className || 'ws-h2' });
    if (tag === 'h3') return createNode('h3', { text: el.textContent.trim(), className: el.className || 'ws-h3' });

    // Paragraph
    if (tag === 'p') return createNode('p', { text: el.textContent.trim(), className: el.className || 'ws-text' });

    // Figure/img
    if (tag === 'figure') {
      var img = el.querySelector('img');
      if (img) return createNode('img', { src: img.src, alt: img.alt, className: img.className || 'w-100 rounded-3' });
    }
    if (tag === 'img') return createNode('img', { src: el.src, alt: el.alt, className: el.className || 'w-100 rounded-3' });

    // Button
    if (tag === 'a' && el.classList.contains('btn')) return createNode('btn', { text: el.textContent.trim(), href: el.getAttribute('href') || '#', className: el.className, padding: el.style.padding || '1.2rem 2.8rem', radius: el.style.borderRadius || '8px' });

    // Widget
    if (el.classList && el.classList.contains('widget-link')) return createNode('widget', { text: el.textContent.trim(), idPath: el.getAttribute('title') || '' });

    // HR
    if (tag === 'hr') return createNode('hr', { color: '#e5e5e5', margin: el.style.margin || '1.6rem 0' });

    // Badge
    if (el.classList && (el.classList.contains('ws-badge-num') || el.classList.contains('ws-badge-round'))) {
      return createNode('badge', { value: el.textContent.trim(), bg: el.style.background || 'var(--bs-primary)', shape: el.classList.contains('ws-badge-round') ? 'round' : 'num' });
    }

    // Stat
    if (el.classList && el.classList.contains('ws-stat-number')) return createNode('stat', { value: el.textContent.trim(), color: el.style.color || 'var(--bs-primary)' });

    // Icon
    if (tag === 'span' && el.querySelector('svg.ws-ico')) {
      var use = el.querySelector('use');
      var href = use ? (use.getAttribute('href') || use.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '') : '';
      var iconName = href.split('#').pop() || 'package';
      var bgMatch = el.className.match(/bg-(\w+)/);
      return createNode('icon', { name: iconName, bg: bgMatch ? bgMatch[1] : 'primary', size: '24' });
    }

    // Aside
    if (tag === 'aside') {
      var titleEl = el.querySelector('.ws-bloc-title');
      var pEl = el.querySelector('p');
      return createNode('aside', {
        title: titleEl ? titleEl.textContent.trim() : '',
        text: pEl ? pEl.textContent.trim() : '',
        borderColor: el.style.borderLeft ? el.style.borderLeft.replace(/4px solid\s*/, '') : 'var(--bs-primary)'
      });
    }

    // Span/label
    if (tag === 'span' && el.classList && el.classList.contains('ws-bloc-title')) {
      return createNode('span', { text: el.textContent.trim(), className: el.className });
    }

    // Generic div with children — recurse
    if (tag === 'div' || tag === 'section') {
      var children = [];
      Array.from(el.children).forEach(function(c) { var n = parseElement(c); if (n) children.push(n); });
      if (children.length === 1) return children[0];
      if (children.length > 1) return createNode('group', { gap: '8px', align: 'center' }, children);
    }

    return null;
  }

  // ─── Public API (window) ───
  window.switchBuilderTab = function(tab) {
    var lib = document.getElementById('bpLibrary');
    var build = document.getElementById('bpBuild');
    var tabLib = document.getElementById('bpTabLibrary');
    var tabBuild = document.getElementById('bpTabBuild');
    if (lib) lib.style.display = tab === 'library' ? 'flex' : 'none';
    if (build) build.style.display = tab === 'build' ? 'flex' : 'none';
    if (tabLib) { tabLib.style.borderBottomColor = tab === 'library' ? 'var(--pr)' : 'transparent'; tabLib.style.color = tab === 'library' ? 'var(--pr)' : 'var(--gray)'; }
    if (tabBuild) { tabBuild.style.borderBottomColor = tab === 'build' ? 'var(--pr)' : 'transparent'; tabBuild.style.color = tab === 'build' ? 'var(--pr)' : 'var(--gray)'; }
    if (tab === 'build') renderPalette();
  };

  window.insertBuiltBlock = function() {
    if (model.children.length === 0) { toast('Canvas vide'); return; }

    var html = exportHtml();

    // Mode edition : remplacer le bloc source
    if (editSourceIdx !== null && editSourceIdx !== '') {
      var blocs = document.querySelectorAll('#editor .bloc');
      var target = blocs[parseInt(editSourceIdx)];
      if (target) {
        target.querySelector('.bloc-content').innerHTML = html;
        closeBlockPicker();
        if (typeof setupImageDropTargets === 'function') setupImageDropTargets();
        if (typeof markDirty === 'function') markDirty();
        toast('Bloc mis a jour');
        editSourceIdx = null;
        resetModel();
        return;
      }
    }

    // Mode insertion
    closeBlockPicker();
    var editor = document.getElementById('editor');
    var div = document.createElement('div');
    div.className = 'bloc';
    div.innerHTML = '<div class="bloc-toolbar"><button onclick="moveBloc(this,-1)">&#8593;</button><button onclick="moveBloc(this,1)">&#8595;</button><button onclick="regenBloc(this)">&#128260;</button><button onclick="regenBlocGuided(this)">&#128161;</button><button onclick="dupeBloc(this)">&#128203;</button><button onclick="saveBlocAsPreset(this)">&#128190;</button><button onclick="deleteBloc(this)">&#10005;</button></div><div class="bloc-content" contenteditable="true" oninput="markDirty()">' + html + '</div>';
    if (typeof insertTarget !== 'undefined' && insertTarget && insertTarget.closest) {
      var nextBloc = insertTarget.closest('.bloc, .insert-bar') ? insertTarget.nextElementSibling : null;
      if (nextBloc) editor.insertBefore(div, nextBloc);
      else editor.appendChild(div);
    } else {
      editor.appendChild(div);
    }
    if (typeof setupImageDropTargets === 'function') setupImageDropTargets();
    if (typeof markDirty === 'function') markDirty();
    toast('Bloc insere');
    editSourceIdx = null;
    resetModel();
  };

  window.saveAsPreset = function() {
    if (model.children.length === 0) { toast('Canvas vide'); return; }
    var nameInput = document.getElementById('bbPresetName');
    var name = nameInput ? nameInput.value.trim() : '';
    if (!name) { toast('Entrez un nom de preset'); if (nameInput) nameInput.focus(); return; }
    var html = exportHtml();
    if (typeof saveCustomBlock === 'function') saveCustomBlock(name, html);
    toast('Preset "' + name + '" sauvegarde sur GitHub');
  };

  window.clearCanvas = function() {
    resetModel();
    renderCanvas();
  };

  window.editInBuilder = function(btn) {
    var bloc = btn.closest('.bloc');
    if (!bloc) return;
    var content = bloc.querySelector('.bloc-content');
    if (!content) return;

    // Ouvrir le builder
    document.getElementById('blockPickerOverlay').classList.add('visible');
    switchBuilderTab('build');

    // Importer le HTML dans le modele
    importHtml(content.innerHTML);

    // Stocker la reference au bloc source
    editSourceIdx = Array.from(document.querySelectorAll('#editor .bloc')).indexOf(bloc);
    toast('Bloc charge dans le builder — modifiez et cliquez Inserer');
  };

  function resetModel() {
    model = { id: uid(), type: 'root', props: {}, children: [] };
    selectedId = null;
    editSourceIdx = null;
  }

  function closeBlockPicker() {
    var overlay = document.getElementById('blockPickerOverlay');
    if (overlay) overlay.classList.remove('visible');
  }

  // toast helper (fallback if not defined globally)
  function toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#333;color:#fff;padding:10px 20px;border-radius:8px;z-index:99999;font-size:13px';
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 2500);
  }

  // ─── Init ───
  var canvas = document.getElementById('bbCanvas');
  if (canvas) renderCanvas();
})();
